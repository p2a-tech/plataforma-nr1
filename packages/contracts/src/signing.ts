/**
 * HMAC SHA-256 da fronteira clínica ↔ PrevIA.
 *
 * - Clínica assina o corpo cru com o segredo compartilhado.
 * - PrevIA recalcula a assinatura sobre o corpo cru recebido e compara
 *   em tempo constante (timingSafeEqual).
 *
 * IMPORTANTE: este módulo importa `node:crypto`. Use só em rotas server-side
 * (API routes, Node services). Não importe no client.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Nome canônico do header da assinatura. */
export const SIGNATURE_HEADER = "x-previa-signature";
/** Nome canônico do header do timestamp (anti-replay). */
export const TIMESTAMP_HEADER = "x-previa-timestamp";
/** Janela máxima de tolerância entre timestamp e agora (anti-replay). */
export const MAX_SKEW_SECONDS = 300;

/** Assina o corpo cru e retorna a string `sha256=<hex>`. */
export function signPayload(rawBody: string, secret: string): string {
  const hex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${hex}`;
}

/** Verificação em tempo constante. Retorna false se a assinatura mal-formada. */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = signPayload(rawBody, secret);
  // ambos devem ter o mesmo tamanho — timingSafeEqual joga se diferir
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Checa que o timestamp é recente o suficiente (anti-replay). */
export function verifyTimestamp(
  timestampHeader: string | null | undefined,
  agoraMs: number = Date.now(),
): boolean {
  if (!timestampHeader) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  const skew = Math.abs(agoraMs / 1000 - ts);
  return skew <= MAX_SKEW_SECONDS;
}
