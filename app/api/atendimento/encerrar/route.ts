/**
 * POST /api/atendimento/encerrar
 *
 * Fecha um atendimento: monta o payload AGREGADO (o único que pode cruzar a
 * barreira), assina com o segredo da clínica (server-side) e envia ao webhook
 * real — exercitando HMAC + validação + idempotência + audit log de ponta a ponta.
 *
 * O browser nunca vê o segredo. A transcrição NÃO entra aqui — só a análise
 * estruturada (ofensores canônicos, severidade) já produzida pela IA.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  SessaoFinalizadaPayload,
  OFENSORES,
  TURNOS,
} from "@previa/contracts";
import { signPayload, SIGNATURE_HEADER, TIMESTAMP_HEADER } from "@previa/contracts/signing";
import { lookupSecretAsync } from "@/lib/clinic-secrets";
import { getSessao } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  clinica_id: z.string().min(1),
  iniciada_em: z.string().datetime({ offset: true }),
  duracao_minutos: z.number().int().min(1).max(240),
  cluster: z.object({
    setor: z.string().min(1),
    turno: z.enum(TURNOS),
    site: z.string().optional(),
  }),
  severidade_estimada: z.enum(["baixa", "media", "alta", "critica"]),
  protocolo_emergencia_acionado: z.boolean().default(false),
  ofensores: z
    .array(
      z.object({
        tag: z.enum(OFENSORES),
        confidence: z.number().min(0).max(1),
        ocorrencias: z.number().int().min(1).max(50).optional(),
      }),
    )
    .max(10),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Payload inválido", detalhe: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }
  const dados = parsed.data;

  // clinica_id vem da SESSÃO autenticada (fonte de verdade); body é fallback.
  const sessao = getSessao();
  const clinicaId = sessao?.clinica_id ?? dados.clinica_id;

  const segredo = await lookupSecretAsync(clinicaId);
  if (!segredo) {
    return NextResponse.json(
      { erro: "Clínica sem segredo provisionado no servidor" },
      { status: 401 },
    );
  }

  // Monta o payload exatamente no formato do contrato (id anônimo opaco).
  const payload = {
    session_id_anon: randomBytes(16).toString("hex"),
    clinica_id: dados.clinica_id,
    iniciada_em: dados.iniciada_em,
    duracao_minutos: dados.duracao_minutos,
    cluster: dados.cluster,
    ofensores: dados.ofensores,
    severidade_estimada: dados.severidade_estimada,
    protocolo_emergencia_acionado: dados.protocolo_emergencia_acionado,
    versao_extractor: "clinic-agent-web@0.1.0",
  };

  // Garante (no perímetro da clínica) que o que vai sair respeita o contrato.
  const validado = SessaoFinalizadaPayload.safeParse(payload);
  if (!validado.success) {
    return NextResponse.json(
      { erro: "Payload não conforme ao contrato", detalhe: validado.error.issues },
      { status: 500 },
    );
  }

  const rawBody = JSON.stringify(validado.data);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const assinatura = signPayload(rawBody, segredo);

  // Envia ao webhook real (mesma origem) — exercita a barreira de ponta a ponta.
  const origin = req.nextUrl.origin;
  let webhookStatus = 0;
  let webhookResposta: unknown = null;
  try {
    const r = await fetch(`${origin}/api/webhook/sessao-finalizada`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SIGNATURE_HEADER]: assinatura,
        [TIMESTAMP_HEADER]: timestamp,
      },
      body: rawBody,
    });
    webhookStatus = r.status;
    webhookResposta = await r.json().catch(() => null);
  } catch (e) {
    console.error("[encerrar] falha ao chamar webhook", e);
  }

  return NextResponse.json(
    {
      enviado: webhookStatus === 200,
      webhook_status: webhookStatus,
      webhook_resposta: webhookResposta,
      // devolve o que ATRAVESSOU a barreira, para a UI mostrar transparência
      payload_enviado: validado.data,
      assinatura,
    },
    { status: 200 },
  );
}
