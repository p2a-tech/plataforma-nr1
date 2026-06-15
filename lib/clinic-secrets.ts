import "server-only";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { sqlAdmin, dbHabilitado } from "@/lib/db";

/**
 * Lookup de segredos por clínica.
 *
 * Hardening E8: o segredo cru NÃO precisa mais viver em env — agora pode ser
 * armazenado CIFRADO em `clinicas.secret_cifrado` (AES-256-GCM). A KEK
 * (Key Encryption Key) fica em env `CLINIC_KEK` (hex de 32 bytes).
 *
 * Ordem de resolução (mais segura → mais legada):
 *   1. `clinicas.secret_cifrado` (bytea) — decifrado com `CLINIC_KEK`.
 *   2. `CLINIC_SECRETS_JSON` (env) — fallback durante a transição.
 *
 * ── Comportamento quando `CLINIC_KEK` está AUSENTE (corrigido · Onda 7) ──
 * O comentário antigo afirmava "falha-fechado em produção", mas o código
 * SEMPRE caía no fallback de env (`CLINIC_SECRETS_JSON`) — independente de
 * ambiente — quando a KEK faltava. Isso NÃO é fail-closed. Decisão atual:
 *   - DEV: tolerante. Sem KEK, ignora `secret_cifrado` e usa o env (acelera o
 *     ciclo). `decifrarSecret` apenas retorna null e avisa por console.
 *   - PRODUÇÃO: FAIL-CLOSED de verdade. Se uma clínica TEM `secret_cifrado`
 *     gravado no DB mas a `CLINIC_KEK` não está configurada, NÃO fazemos o
 *     downgrade silencioso pro env — `lookupSecretAsync` retorna null e loga
 *     erro. Motivo: cair pro env legado em prod mascara um erro de
 *     configuração de KEK e pode usar um segredo antigo/rotacionado. Já
 *     clínicas SEM `secret_cifrado` (ainda 100% em env) seguem usando o env
 *     normalmente — não há o que falhar-fechar.
 *
 * Layout do bytea cifrado: iv(12) || authTag(16) || ciphertext(N).
 *
 * Helpers exportados:
 *   - `lookupSecret(id)` mantém a assinatura síncrona pra não quebrar
 *      `app/api/atendimento/encerrar/route.ts`. Internamente devolve o último
 *      valor conhecido no cache (DB ou env).
 *   - `lookupSecretAsync(id)` força refresh do DB.
 *   - `cifrarSecret(plain)` e `decifrarSecret(buf)` para provisionamento.
 *   - `fingerprint(secret)` mantém compatibilidade com webhook.
 */

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

type SegredosMap = Record<string, string>;

let envCache: SegredosMap | null = null;
let envCacheValido = false;
const dbCache = new Map<string, string>();

function carregarEnv(): SegredosMap {
  if (envCacheValido && envCache) return envCache;
  const raw = process.env.CLINIC_SECRETS_JSON;
  if (!raw) {
    envCache = {};
    envCacheValido = true;
    return envCache;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      envCache = parsed as SegredosMap;
      envCacheValido = true;
      return envCache;
    }
  } catch {
    /* malformado — tratamos como vazio */
  }
  envCache = {};
  envCacheValido = true;
  return envCache;
}

function obterKEK(): Buffer | null {
  const hex = process.env.CLINIC_KEK;
  if (!hex) return null;
  try {
    const buf = Buffer.from(hex, "hex");
    if (buf.length !== 32) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[clinic-secrets] CLINIC_KEK deve ter 32 bytes (64 hex chars)");
      }
      return null;
    }
    return buf;
  } catch {
    return null;
  }
}

/** Cifra um segredo em formato `iv(12) || tag(16) || ciphertext`. */
export function cifrarSecret(plain: string): Buffer {
  const kek = obterKEK();
  if (!kek) {
    throw new Error("CLINIC_KEK não configurada — não posso cifrar.");
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, kek, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

/** Decifra. Retorna null em qualquer falha (fail-closed). */
export function decifrarSecret(buf: Buffer | Uint8Array | null | undefined): string | null {
  if (!buf) return null;
  const kek = obterKEK();
  if (!kek) {
    if (process.env.NODE_ENV === "production") return null;
    return null;
  }
  try {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (b.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = b.subarray(0, IV_LEN);
    const tag = b.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = b.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALG, kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Refresh assíncrono: lê `clinicas.secret_cifrado` do DB e popula cache.
 *
 * Fail-closed em produção (Onda 7): se a clínica TEM `secret_cifrado` mas a
 * `CLINIC_KEK` está ausente/inválida, NÃO faz downgrade pro env — retorna null
 * e loga erro. Em dev, segue tolerante (cai pro env).
 */
export async function lookupSecretAsync(clinicaId: string): Promise<string | null> {
  const kek = obterKEK();

  if (dbHabilitado) {
    try {
      const [row] = await sqlAdmin<{ secret_cifrado: Buffer | null }[]>`
        select secret_cifrado from public.clinicas where id = ${clinicaId} limit 1
      `;
      if (row?.secret_cifrado) {
        // Clínica já migrada (segredo cifrado no DB).
        if (!kek) {
          // FAIL-CLOSED em prod: sem KEK não há como decifrar o segredo
          // canônico — recusar é mais seguro que usar um env legado/rotacionado.
          if (process.env.NODE_ENV === "production") {
            console.error(
              "[clinic-secrets] secret_cifrado presente mas CLINIC_KEK ausente em produção — fail-closed (return null).",
            );
            return null;
          }
          // DEV: tolerante — segue pro fallback de env abaixo.
          console.warn(
            "[clinic-secrets] secret_cifrado presente mas CLINIC_KEK ausente (dev) — caindo pro env.",
          );
        } else {
          const plain = decifrarSecret(row.secret_cifrado);
          if (plain) {
            dbCache.set(clinicaId, plain);
            return plain;
          }
          // KEK presente mas decifração falhou (tag inválida etc.). Em prod,
          // não mascara com env — algo está errado com o segredo/KEK.
          if (process.env.NODE_ENV === "production") {
            console.error(
              "[clinic-secrets] falha ao decifrar secret_cifrado em produção — fail-closed (return null).",
            );
            return null;
          }
        }
      }
    } catch (e) {
      console.warn("[clinic-secrets] falha lendo secret_cifrado:", e);
    }
  }
  const env = carregarEnv()[clinicaId];
  if (env) return env;
  return dbCache.get(clinicaId) ?? null;
}

/**
 * Lookup síncrono (mantém compat com webhook). Resolve nesta ordem:
 *   1. Cache populado por `lookupSecretAsync` (refresh recente do DB).
 *   2. Env `CLINIC_SECRETS_JSON`.
 */
export function lookupSecret(clinicaId: string): string | null {
  return dbCache.get(clinicaId) ?? carregarEnv()[clinicaId] ?? null;
}

/** Hash sha256 hex de um segredo (mesmo formato gravado em `webhook_secret_hash`). */
export function fingerprint(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Force-clear de caches (útil em testes). */
export function _resetClinicSecretsCache(): void {
  envCache = null;
  envCacheValido = false;
  dbCache.clear();
}
