/**
 * WhatsApp Cloud API — webhook do Radar.
 *   GET  → verificação do webhook (Meta).
 *   POST → mensagens recebidas. Fluxo do micro-pulso:
 *          energia (botões `e:<setor>:<turno>:<n>`) → ofensor (`o:<tag>` ou `pular`)
 *          → grava resposta anônima em pulso_respostas.
 *
 * O cluster vem codificado nos botões enviados no convite (definido na origem),
 * então a plataforma nunca pergunta dados identificáveis. Telefone só como hash.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  VERIFY_TOKEN,
  parseInbound,
  verificarAssinaturaMeta,
  hashTelefone,
  enviarBotoes,
  enviarTexto,
} from "@/lib/whatsapp";
import { ENERGIA_OPCOES } from "@/lib/radar";
import { OFENSORES_LABEL } from "@previa/contracts";
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Verificação (Meta chama com hub.* ao registrar o webhook) ──────────────
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

const OFENSOR_PULSO = [
  "sobrecarga_trabalho",
  "ritmo_pressao_metas",
  "conflito_lideranca",
  "jornada_descanso_insuficiente",
] as const;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verificarAssinaturaMeta(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("ok", { status: 200 }); // Meta espera 200 sempre
  }

  const msg = parseInbound(body);
  if (!msg || !dbHabilitado) return new NextResponse("ok", { status: 200 });

  const tel = hashTelefone(msg.from);

  try {
    // Resposta de ENERGIA: "e:<empresa>:<setor>:<turno>:<n>"
    if (msg.buttonId?.startsWith("e:")) {
      const [, empresaId, setor, turno, n] = msg.buttonId.split(":");
      const energia = Number(n);
      if (!empresaId) return new NextResponse("ok", { status: 200 });
      // LGPD (E7.1): este opt-in É o momento do consentimento. Registramos a
      // versão do termo vigente na sessão e no livro-razão durável.
      const [termo] = await sql<{ versao: string }[]>`
        select versao from public.termos_consentimento where vigente limit 1
      `;
      const termoVersao = termo?.versao ?? null;
      await sql`
        insert into public.pulso_sessoes
          (empresa_id, telefone_hash, cluster_setor, cluster_turno, etapa, energia, consentido_em, termo_versao, atualizado_em)
        values (${empresaId}, ${tel}, ${setor}, ${turno}, 'ofensor', ${energia}, now(), ${termoVersao}, now())
        on conflict (telefone_hash) do update
          set empresa_id = excluded.empresa_id,
              cluster_setor = excluded.cluster_setor, cluster_turno = excluded.cluster_turno,
              etapa = 'ofensor', energia = excluded.energia,
              consentido_em = coalesce(public.pulso_sessoes.consentido_em, now()),
              termo_versao = coalesce(public.pulso_sessoes.termo_versao, excluded.termo_versao),
              atualizado_em = now()
      `;
      await sql`
        insert into public.consentimentos (empresa_id, telefone_hash, termo_versao, canal)
        values (${empresaId}, ${tel}, ${termoVersao}, 'whatsapp')
      `;
      await enviarBotoes(
        msg.from,
        "Obrigado 💙 O que mais tem pesado ultimamente?",
        [
          ...OFENSOR_PULSO.slice(0, 2).map((t) => ({ id: `o:${t}`, titulo: OFENSORES_LABEL[t] })),
          { id: "pular", titulo: "Prefiro não dizer" },
        ],
      );
      return new NextResponse("ok", { status: 200 });
    }

    // Resposta de OFENSOR (ou "pular") → grava a resposta anônima e encerra
    if (msg.buttonId?.startsWith("o:") || msg.buttonId === "pular") {
      const [sess] = await sql<
        { empresa_id: string; cluster_setor: string; cluster_turno: string; energia: number }[]
      >`select empresa_id, cluster_setor, cluster_turno, energia from public.pulso_sessoes where telefone_hash = ${tel}`;
      if (sess) {
        const ofensor = msg.buttonId.startsWith("o:") ? msg.buttonId.slice(2) : null;
        await sql`
          insert into public.pulso_respostas
            (empresa_id, cluster_setor, cluster_turno, canal, energia, ofensor)
          values (${sess.empresa_id}, ${sess.cluster_setor}, ${sess.cluster_turno}, 'whatsapp', ${sess.energia}, ${ofensor})
        `;
        await sql`delete from public.pulso_sessoes where telefone_hash = ${tel}`;
        await enviarTexto(
          msg.from,
          "Recebido, e obrigado por participar 🧡 Suas respostas entram de forma anônima e agregada. Se quiser conversar com um psicólogo parceiro, em sigilo, é só responder ACOLHIMENTO.",
        );
      }
      return new NextResponse("ok", { status: 200 });
    }

    // Qualquer outra mensagem → reinicia o pulso (sem cluster conhecido, ignora)
    return new NextResponse("ok", { status: 200 });
  } catch (e) {
    console.error("[webhook/whatsapp] erro", e);
    return new NextResponse("ok", { status: 200 });
  }
}
