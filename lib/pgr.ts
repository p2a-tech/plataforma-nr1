import "server-only";
import { createHash, createHmac } from "node:crypto";

/**
 * Núcleo criptográfico da assinatura do PGR.
 *
 * - `hashConteudo`: sha256 determinístico de um snapshot canônico do PGR.
 *   Mesmo conteúdo → mesmo hash. Qualquer mudança nos riscos/conformidade
 *   muda o hash → a assinatura anterior deixa de cobrir o estado atual.
 * - `selarAssinatura`: HMAC (tamper-evident) ligando hash + assinante + tempo.
 *   Permite provar depois que aquele responsável assinou aquele conteúdo.
 */

/** Segredo lazy + fail-closed em produção (não cai em default conhecido). */
function getSecret(): string {
  const s = process.env.PGR_SECRET || process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PGR_SECRET/AUTH_SECRET não configurada em produção (fail-closed).");
  }
  return "dev-pgr-secret-trocar";
}

/** Ordena chaves recursivamente para um JSON canônico (hash estável). */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = canonical((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

export function hashConteudo(snapshot: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(snapshot))).digest("hex");
}

export function selarAssinatura(p: {
  hash: string;
  nome: string;
  papel: string;
  ts: string;
}): string {
  return createHmac("sha256", getSecret())
    .update(`${p.hash}|${p.nome}|${p.papel}|${p.ts}`)
    .digest("hex");
}

/** Reverifica que um selo confere (auditoria). */
export function seloValido(
  selo: string,
  p: { hash: string; nome: string; papel: string; ts: string },
): boolean {
  return selarAssinatura(p) === selo;
}
