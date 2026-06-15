import "server-only";
import { sqlAdmin, dbHabilitado } from "@/lib/db";

/**
 * Revogação imediata de sessão (Onda 7 · Dev B · Refinos F).
 *
 * `exigirSessao` (lib/auth.ts) é SÍNCRONO (lê cookie, sem DB) e é chamado em
 * dezenas de pages — não dá pra torná-lo async sem refatorar tudo. Em vez
 * disso, fazemos a re-checagem de `usuarios.ativo` aqui, consumido pelo
 * `app/(plataforma)/layout.tsx` (async server component que roda em TODA página
 * autenticada da plataforma).
 *
 * Quando um admin desativa um usuário (`usuarios.ativo = false`), o login já
 * recusa (auth-handlers). MAS uma sessão JÁ EMITIDA (cookie HMAC válido por até
 * 8h) continuaria funcionando até expirar. Este guard fecha essa janela: a cada
 * navegação, o layout pergunta "este usuário ainda está ativo?" e, se não,
 * invalida a sessão.
 *
 * ── Política de cache (decisão) ──
 * Consultar o DB a cada navegação é barato (lookup indexado por email único),
 * mas multiplicado por toda a plataforma vira ruído. Usamos um cache em memória
 * (Map por email) com TTL curto (`TTL_MS`, default 30s):
 *   - Reduz a carga no DB sem comprometer a segurança de forma relevante: a
 *     janela máxima entre "admin desativa" e "sessão cai" passa a ser o TTL
 *     (30s), muito melhor que as 8h da expiração natural do cookie.
 *   - O cache é POSITIVO (ativo=true) e NEGATIVO (ativo=false): ambos os
 *     veredictos são cacheados pelo TTL. Quem foi desativado é bloqueado já no
 *     próximo request e permanece bloqueado.
 *   - `purgarCacheSessao(email)` permite invalidar pontualmente (ex.: o próprio
 *     endpoint de desativação poderia chamar — não obrigatório nesta onda).
 *
 * ── Fail-open (decisão) ──
 * Se a consulta ao DB falhar (blip de conexão, timeout), NÃO deslogamos: um
 * problema momentâneo de infraestrutura não pode derrubar TODOS os usuários
 * logados. Retornamos `"ok"` em erro de DB. Apenas um veredicto explícito de
 * "usuário inativo/inexistente" revoga a sessão.
 */

export type VereditoSessao = "ok" | "revogar";

export const TTL_MS = 30_000;

interface EntradaCache {
  ativo: boolean;
  /** epoch ms em que a entrada foi gravada. */
  em: number;
}

const cache = new Map<string, EntradaCache>();

/** Normaliza o email pra chave de cache/lookup (case-insensitive, trim). */
function chave(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Decide se uma entrada de cache ainda é válida para `agora` (epoch ms),
 * considerando o `ttlMs`. Pura — testável sem relógio real.
 */
export function entradaValida(
  entrada: EntradaCache | undefined,
  agora: number,
  ttlMs: number = TTL_MS,
): entrada is EntradaCache {
  if (!entrada) return false;
  return agora - entrada.em < ttlMs;
}

/**
 * Traduz "usuário está ativo?" em veredicto. `null` (usuário não encontrado /
 * sumiu) também revoga — uma sessão de um usuário deletado não deve persistir.
 * Pura — base dos testes do guard.
 */
export function vereditoPorAtivo(ativo: boolean | null | undefined): VereditoSessao {
  return ativo ? "ok" : "revogar";
}

/** Invalida a entrada de cache de um email (ou tudo, se omitido). */
export function purgarCacheSessao(email?: string): void {
  if (email === undefined) {
    cache.clear();
    return;
  }
  cache.delete(chave(email));
}

/** Apenas para testes: força um valor no cache. */
export function _setCacheSessao(email: string, ativo: boolean, em: number): void {
  cache.set(chave(email), { ativo, em });
}

/** Apenas para testes: inspeciona o cache. */
export function _getCacheSessao(email: string): EntradaCache | undefined {
  return cache.get(chave(email));
}

/**
 * Consulta `usuarios.ativo` por email (case-insensitive), com cache TTL.
 *
 * - Cache hit válido → usa o valor cacheado (sem DB).
 * - Cache miss/expirado → 1 query indexada (sqlAdmin, cross-tenant: o guard
 *   roda antes de qualquer escopo de tenant). Resultado é cacheado (positivo
 *   E negativo).
 * - Erro de DB → fail-open ("ok"), e NÃO cacheia (pra reconsultar logo).
 * - DB desabilitado → "ok" (ambientes sem banco; o login já seria 503).
 *
 * `now` é injetável pra testes determinísticos.
 */
export async function avaliarSessao(
  email: string,
  opts: { ttlMs?: number; now?: () => number } = {},
): Promise<VereditoSessao> {
  if (!dbHabilitado) return "ok";

  const ttlMs = opts.ttlMs ?? TTL_MS;
  const agora = (opts.now ?? Date.now)();
  const k = chave(email);

  const cached = cache.get(k);
  if (entradaValida(cached, agora, ttlMs)) {
    return vereditoPorAtivo(cached.ativo);
  }

  try {
    const rows = await sqlAdmin<{ ativo: boolean }[]>`
      select ativo from public.usuarios
       where lower(email) = ${k}
       limit 1
    `;
    if (rows.length === 0) {
      // Usuário sumiu (deletado) → revoga. Cacheia o negativo.
      cache.set(k, { ativo: false, em: agora });
      return "revogar";
    }
    const ativo = rows[0].ativo !== false;
    cache.set(k, { ativo, em: agora });
    return vereditoPorAtivo(ativo);
  } catch {
    // Fail-open: blip de DB não pode derrubar todos os logados.
    return "ok";
  }
}
