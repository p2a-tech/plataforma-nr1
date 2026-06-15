import "server-only";
import { sqlAdmin, dbHabilitado } from "@/lib/db";

/**
 * Infra de notificação (Onda 6 · Dev B) — dispatcher pluggable, SEM novas
 * dependências npm (usa apenas `fetch` nativo do Node 18+).
 *
 * Canais, por ordem de preferência (escolhidos por env):
 *   1. RESEND_API_KEY  → e-mail transacional via API do Resend.
 *   2. SLACK_WEBHOOK_URL → resumo no Slack (quando não há e-mail configurado).
 *   3. nenhum          → no-op seguro: só persiste em `notificacoes` + console.log.
 *
 * `notificar()` SEMPRE grava em `public.notificacoes` (trilha) e tenta despachar
 * pros canais. `enviarEmail()` é o primitivo de envio (usado pelo reset de senha
 * e, indiretamente, por `notificar`).
 *
 * FAIL-SAFE: nenhuma função lança. Erros viram `{ ok:false, canal }` + console.
 * Notificação NUNCA deve derrubar o fluxo de negócio (criar evento, DSAR, etc.).
 */

export type CanalNotificacao = "email" | "slack" | "persistido" | "nenhum";

export type TipoNotificacao =
  | "risco_grave"
  | "dsar"
  | "reset_senha"
  | "generico";

export interface ResultadoEnvio {
  ok: boolean;
  canal: CanalNotificacao;
}

export interface EmailParams {
  para: string | string[];
  assunto: string;
  html: string;
  /** Versão texto puro (fallback de e-mail clients sem HTML). Opcional. */
  texto?: string;
}

export interface NotificarParams {
  tipo: TipoNotificacao;
  empresa_id?: string | null;
  titulo: string;
  corpo: string;
  /** Override do destino de e-mail. Default: NOTIFY_TO (DPO/SST da plataforma). */
  destino?: string | string[];
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fromAddress(): string {
  return process.env.NOTIFY_FROM || "PrevIA <nao-responda@p2a.tech>";
}

function comoArray(v: string | string[]): string[] {
  return Array.isArray(v) ? v : [v];
}

/**
 * Envia um e-mail pelo canal configurado. Ordem: Resend → Slack (resumo) →
 * no-op (console). Nunca lança.
 */
export async function enviarEmail(p: EmailParams): Promise<ResultadoEnvio> {
  const resendKey = process.env.RESEND_API_KEY;
  const slackUrl = process.env.SLACK_WEBHOOK_URL;

  // ── 1. Resend ──────────────────────────────────────────────────────────────
  if (resendKey) {
    try {
      const resp = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: comoArray(p.para),
          subject: p.assunto,
          html: p.html,
          ...(p.texto ? { text: p.texto } : {}),
        }),
      });
      if (resp.ok) return { ok: true, canal: "email" };
      console.error("[notify] Resend respondeu", resp.status);
      return { ok: false, canal: "email" };
    } catch (e) {
      console.error("[notify] falha ao enviar e-mail (Resend)", e);
      return { ok: false, canal: "email" };
    }
  }

  // ── 2. Slack (resumo) ──────────────────────────────────────────────────────
  if (slackUrl) {
    try {
      const destino = comoArray(p.para).join(", ");
      const resp = await fetch(slackUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: `*${p.assunto}*\nPara: ${destino}\n${p.texto ?? "(conteúdo HTML)"}`,
        }),
      });
      if (resp.ok) return { ok: true, canal: "slack" };
      console.error("[notify] Slack respondeu", resp.status);
      return { ok: false, canal: "slack" };
    } catch (e) {
      console.error("[notify] falha ao enviar resumo (Slack)", e);
      return { ok: false, canal: "slack" };
    }
  }

  // ── 3. No-op seguro ────────────────────────────────────────────────────────
  console.log("[notify] (no-op) e-mail não enviado — sem RESEND_API_KEY/SLACK_WEBHOOK_URL", {
    para: comoArray(p.para),
    assunto: p.assunto,
  });
  return { ok: false, canal: "nenhum" };
}

/**
 * Persiste a notificação na trilha (`public.notificacoes`) e tenta despachar
 * pros canais configurados. SEMPRE grava (mesmo sem canal). Nunca lança.
 *
 * @returns canal efetivamente usado no despacho (ou 'persistido'/'nenhum').
 */
export async function notificar(p: NotificarParams): Promise<ResultadoEnvio> {
  const resendKey = process.env.RESEND_API_KEY;
  const slackUrl = process.env.SLACK_WEBHOOK_URL;

  // Despacho (best-effort). Decidimos o destino: override > NOTIFY_TO.
  let canal: CanalNotificacao = "persistido";
  let despachoOk = false;

  if (resendKey || slackUrl) {
    const destino = p.destino ?? process.env.NOTIFY_TO;
    // Sem destino de e-mail configurado e só Resend disponível → cai no Slack se
    // houver, senão fica como 'persistido'.
    if (resendKey && destino) {
      const r = await enviarEmail({
        para: destino,
        assunto: p.titulo,
        html: `<p>${escapeHtml(p.corpo)}</p>`,
        texto: p.corpo,
      });
      canal = r.canal;
      despachoOk = r.ok;
    } else if (slackUrl) {
      const r = await enviarEmail({
        // enviarEmail sem Resend cai no Slack; 'para' é só rótulo no resumo.
        para: destino ?? "#previa-alertas",
        assunto: p.titulo,
        html: "",
        texto: p.corpo,
      });
      canal = r.canal;
      despachoOk = r.ok;
    }
  }

  // Trilha: persiste sempre (best-effort; falha de DB não derruba o negócio).
  if (dbHabilitado) {
    try {
      await sqlAdmin`
        insert into public.notificacoes (tipo, empresa_id, titulo, corpo, canal, status)
        values (
          ${p.tipo}, ${p.empresa_id ?? null}, ${p.titulo}, ${p.corpo},
          ${canal}, ${despachoOk ? "enviada" : canal === "persistido" || canal === "nenhum" ? "enfileirada" : "falhou"}
        )
      `;
    } catch (e) {
      console.error("[notify] falha ao persistir notificação", e);
    }
  } else {
    console.log("[notify] (db off) notificação não persistida", {
      tipo: p.tipo,
      titulo: p.titulo,
    });
  }

  return { ok: despachoOk, canal };
}

/** Escape mínimo para interpolar `corpo` num <p> sem injeção de HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
