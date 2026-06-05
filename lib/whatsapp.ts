import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Adapter do WhatsApp Cloud API (Meta). Production-shaped: assim que um número
 * for conectado (WHATSAPP_TOKEN + WHATSAPP_PHONE_ID), o envio passa a funcionar.
 * Sem credenciais, o envio é no-op (loga) — o webhook de recebimento segue ativo.
 *
 * Privacidade: o telefone NUNCA é persistido. Guardamos só um hash (sessão).
 */

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
export const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "previa-radar-verify";
const SALT = process.env.WHATSAPP_SALT || "previa-salt";

export const whatsappConfigurado = Boolean(TOKEN && PHONE_ID);

export function hashTelefone(telefone: string): string {
  return createHash("sha256").update(telefone + SALT).digest("hex");
}

/** Verifica a assinatura X-Hub-Signature-256 (se o app secret estiver configurado). */
export function verificarAssinaturaMeta(rawBody: string, header?: string | null): boolean {
  if (!APP_SECRET) return true; // sem secret configurado, não bloqueia (dev)
  if (!header || !header.startsWith("sha256=")) return false;
  const esperado = "sha256=" + createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface InboundMsg {
  from: string;
  texto?: string;
  /** id do botão/opção interativa (ex.: "e:Logística:noite:2", "o:sobrecarga_trabalho", "pular"). */
  buttonId?: string;
}

/** Extrai a mensagem relevante do payload do webhook da Meta. */
export function parseInbound(body: any): InboundMsg | null {
  try {
    const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return null;
    const from = msg.from as string;
    if (msg.type === "interactive") {
      const i = msg.interactive;
      const id = i?.button_reply?.id ?? i?.list_reply?.id;
      return { from, buttonId: id };
    }
    if (msg.type === "button") return { from, buttonId: msg.button?.payload };
    if (msg.type === "text") return { from, texto: msg.text?.body };
    return { from };
  } catch {
    return null;
  }
}

/** Envia botões interativos. No-op (loga) se não configurado. */
export async function enviarBotoes(
  to: string,
  texto: string,
  botoes: { id: string; titulo: string }[],
): Promise<void> {
  if (!whatsappConfigurado) {
    console.log(`[whatsapp:dev] → ${to}: "${texto}" [${botoes.map((b) => b.titulo).join(" | ")}]`);
    return;
  }
  await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: texto },
        action: { buttons: botoes.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.titulo } })) },
      },
    }),
  }).catch((e) => console.error("[whatsapp] envio falhou", e));
}

export async function enviarTexto(to: string, texto: string): Promise<void> {
  if (!whatsappConfigurado) {
    console.log(`[whatsapp:dev] → ${to}: "${texto}"`);
    return;
  }
  await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: texto } }),
  }).catch((e) => console.error("[whatsapp] envio falhou", e));
}
