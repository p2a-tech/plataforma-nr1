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
 * Em produção (NODE_ENV=production), se `CLINIC_KEK` não estiver setada, o
 * decifração falha-fechado (return null). Em dev é tolerante para acelerar
 * o ciclo, mas avisa por console.
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

/** Refresh assíncrono: lê `clinicas.secret_cifrado` do DB e popula cache. */
export async function lookupSecretAsync(clinicaId: string): Promise<string | null> {
  if (dbHabilitado && obterKEK()) {
    try {
      const [row] = await sqlAdmin<{ secret_cifrado: Buffer | null }[]>`
        select secret_cifrado from public.clinicas where id = ${clinicaId} limit 1
      `;
      if (row?.secret_cifrado) {
        const plain = decifrarSecret(row.secret_cifrado);
        if (plain) {
          dbCache.set(clinicaId, plain);
          return plain;
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
