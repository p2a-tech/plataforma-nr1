import "server-only";
import { createHash } from "node:crypto";

/**
 * Lookup do webhook secret de cada clínica.
 *
 * Por design, o segredo cru NUNCA é armazenado no DB. Ele vive como variável
 * de ambiente (em produção: Secret Manager / Vercel Encrypted Env Vars).
 * O DB armazena apenas a `webhook_secret_hash` (sha256 hex) como fingerprint —
 * pra confirmar que a env corresponde à clínica certa e detectar rotações.
 *
 * Formato esperado da env:
 *   CLINIC_SECRETS_JSON='{"clin_translog_demo":"demo-secret-do-not-use-in-prod"}'
 *
 * Em produção troque por: Supabase Vault, AWS Secrets Manager, Doppler etc.
 */

type SegredosMap = Record<string, string>;

let cache: SegredosMap | null = null;
let cacheValido = false;

function carregar(): SegredosMap {
  if (cacheValido && cache) return cache;
  const raw = process.env.CLINIC_SECRETS_JSON;
  if (!raw) {
    cache = {};
    cacheValido = true;
    return cache;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      cache = parsed as SegredosMap;
      cacheValido = true;
      return cache;
    }
  } catch {
    /* malformado — tratamos como vazio */
  }
  cache = {};
  cacheValido = true;
  return cache;
}

/** Recupera o segredo de uma clínica via env. Retorna null se não existir. */
export function lookupSecret(clinicaId: string): string | null {
  const map = carregar();
  return map[clinicaId] ?? null;
}

/** Hash sha256 hex de um segredo (mesmo formato gravado no DB). */
export function fingerprint(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}
