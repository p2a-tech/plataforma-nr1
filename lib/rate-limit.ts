/**
 * Rate limiter de janela fixa, em memória, sem dependências externas.
 *
 * Adequado a UMA instância de servidor Node (process único). O estado vive num
 * `Map` no heap do processo, então NÃO é compartilhado entre múltiplas
 * instâncias/réplicas nem sobrevive a um restart/cold-start.
 *
 * TODO(prod multi-instância): para produção com mais de uma réplica (ex.: várias
 * lambdas/containers atrás de um load balancer), substituir o `Map` por um store
 * compartilhado — tipicamente Redis com INCR + EXPIRE (ou um algoritmo de token
 * bucket atômico via Lua). A assinatura pública de `rateLimit` pode ser mantida.
 *
 * Uso típico num route handler (App Router):
 *   import { rateLimit, clientIp, rateLimitKey } from "@/lib/rate-limit";
 *
 *   export async function POST(req: Request) {
 *     const key = rateLimitKey(["pulso", clientIp(req)]);
 *     const rl = rateLimit(key, { limit: 30, windowMs: 60_000 });
 *     if (!rl.ok) {
 *       return new Response("Too Many Requests", {
 *         status: 429,
 *         headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) },
 *       });
 *     }
 *     // ... segue o fluxo normal
 *   }
 *
 * Sem `server-only`: o módulo é TS puro, então é importável em testes unitários
 * (Vitest, ambiente node) e em qualquer route handler.
 */

/** Entrada de uma janela fixa para uma chave. */
interface Janela {
  /** Quantidade de requisições contabilizadas na janela atual. */
  count: number;
  /** Timestamp (ms epoch) em que a janela atual expira e deve ser reiniciada. */
  resetAt: number;
}

/** Opções de limitação para uma chave. */
export interface RateLimitOptions {
  /** Número máximo de requisições permitidas dentro da janela. */
  limit: number;
  /** Duração da janela, em milissegundos. */
  windowMs: number;
}

/** Resultado de uma avaliação de rate limit. */
export interface RateLimitResult {
  /** `true` se a requisição está dentro do limite; `false` se deve ser bloqueada. */
  ok: boolean;
  /** Requisições restantes na janela atual (nunca negativo). */
  remaining: number;
  /** Quando bloqueado, ms até a janela reiniciar; `0` quando `ok`. */
  retryAfterMs: number;
}

/**
 * Store em memória, por instância. Chave → janela fixa.
 *
 * Exportado apenas indiretamente via `__resetRateLimitStore()` para testes; o
 * `Map` em si permanece encapsulado no módulo.
 */
const store = new Map<string, Janela>();

/**
 * Limiar de tamanho do `Map` a partir do qual fazemos uma poda oportunista de
 * entradas expiradas. Mantém o uso de memória limitado sem precisar de timers
 * ou processos de limpeza periódica.
 */
const PRUNE_THRESHOLD = 10_000;

/**
 * Poda oportunista O(n): percorre o `Map` uma única vez removendo janelas já
 * expiradas. Só roda quando o `Map` cresce além de `PRUNE_THRESHOLD`, então o
 * custo amortizado por chamada de `rateLimit` permanece O(1) no caso comum.
 *
 * @param now Timestamp de referência (ms epoch).
 */
function pruneExpirado(now: number): void {
  if (store.size <= PRUNE_THRESHOLD) return;
  for (const [chave, janela] of store) {
    if (now > janela.resetAt) store.delete(chave);
  }
}

/**
 * Avalia (e contabiliza) uma requisição contra um limite de janela fixa.
 *
 * Em cada chamada: se `now > resetAt`, a janela é reiniciada (count zera e uma
 * nova `resetAt = now + windowMs` é definida). O contador é então incrementado.
 * A requisição é permitida (`ok`) enquanto `count <= limit`.
 *
 * @param key Identificador da entidade limitada (ex.: `"pulso:203.0.113.7"`).
 * @param opts `{ limit, windowMs }` — máximo de requisições por janela.
 * @param now Timestamp opcional (ms epoch) para testes determinísticos.
 *            Default: `Date.now()`. Injetar este valor evita depender de timers
 *            reais nos testes.
 * @returns `{ ok, remaining, retryAfterMs }`.
 */
export function rateLimit(
  key: string,
  opts: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  const { limit, windowMs } = opts;

  pruneExpirado(now);

  let janela = store.get(key);

  // Janela inexistente ou expirada → (re)inicia.
  if (!janela || now > janela.resetAt) {
    janela = { count: 0, resetAt: now + windowMs };
    store.set(key, janela);
  }

  janela.count += 1;

  const ok = janela.count <= limit;
  const remaining = Math.max(0, limit - janela.count);
  const retryAfterMs = ok ? 0 : janela.resetAt - now;

  return { ok, remaining, retryAfterMs };
}

/**
 * Extrai o IP do cliente a partir dos cabeçalhos de proxy.
 *
 * Considera `x-forwarded-for` (usando o PRIMEIRO IP da lista, que é o do cliente
 * original) e, em fallback, `x-real-ip`. Se nenhum estiver presente, retorna
 * `"unknown"` — útil como chave de fallback em ambientes sem proxy confiável.
 *
 * Observação de segurança: estes cabeçalhos são facilmente forjáveis por um
 * cliente mal-intencionado se não houver um proxy/edge confiável reescrevendo-os.
 * Em produção, confie apenas no valor injetado pela sua borda (Vercel/CDN).
 *
 * @param req Objeto `Request` (Fetch API) ou qualquer `{ headers: Headers }`.
 * @returns O IP do cliente, ou `"unknown"`.
 */
export function clientIp(req: Request | { headers: Headers }): string {
  const headers = req.headers;

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const primeiro = xff.split(",")[0]?.trim();
    if (primeiro) return primeiro;
  }

  const real = headers.get("x-real-ip");
  if (real) {
    const ip = real.trim();
    if (ip) return ip;
  }

  return "unknown";
}

/**
 * Monta uma chave de rate limit juntando as partes não-vazias com `:`.
 *
 * Partes `null`, `undefined` ou strings vazias/só-espaço são descartadas, então
 * é seguro passar valores opcionais (ex.: `rateLimitKey(["pulso", clinicaId, ip])`).
 *
 * @param parts Partes da chave (em ordem).
 * @returns A chave concatenada (ex.: `"pulso:clinica-42:203.0.113.7"`).
 */
export function rateLimitKey(parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p == null ? "" : p.trim()))
    .filter((p) => p.length > 0)
    .join(":");
}

/**
 * APENAS PARA TESTES: limpa todo o estado do limiter em memória.
 *
 * Chame em `beforeEach` para garantir isolamento entre testes. Não use em
 * código de produção.
 */
export function __resetRateLimitStore(): void {
  store.clear();
}
