/**
 * POST /api/risco-grave
 *
 * Recebe um evento de risco grave/iminente vindo da clínica parceira (ou do
 * próprio atendimento, quando o protocolo é acionado pelo profissional).
 *
 * Como a clínica não tem sessão de empresa, descobrimos `empresa_id` lendo
 * `clinicas` via `sqlAdmin` (cross-tenant, antes do escopo). Em seguida abrimos
 * `withEmpresa(empresaId)` para que o INSERT passe pelo RLS.
 *
 * NUNCA armazenamos PII aqui — `marcador_anonimo` é opaco. Notificação ao DPO
 * é apenas um console.log por enquanto (a integração real vai pelo canal seguro
 * da empresa: e-mail/Slack/PagerDuty conforme configurado).
 *
 * ─── Segurança (Onda 3) ────────────────────────────────────────────────────
 * Mesmo protocolo HMAC do `/api/webhook/sessao-finalizada`:
 *   1. `X-Previa-Timestamp` (epoch seconds, janela ±5min) — anti-replay.
 *   2. `X-Previa-Signature` (sha256=<hex>) — HMAC sobre o BODY RAW (timing-safe).
 *   3. Fingerprint do segredo bate com `clinicas.webhook_secret_hash`.
 * Sem isso qualquer um que descobrisse um clinica_id poderia injetar eventos
 * de risco grave fake.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
  verifyTimestamp,
} from "@previa/contracts/signing";
import { sqlAdmin, dbHabilitado } from "@/lib/db";
import { lookupSecretAsync, fingerprint } from "@/lib/clinic-secrets";
import { criarEvento } from "@/lib/risco-grave";
import { notificar } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    clinica_id: z.string().trim().min(1).max(80),
    marcador_anonimo: z.string().trim().min(1).max(120),
    tipo: z.enum([
      "ideacao_suicida",
      "violencia_iminente",
      "surto_psiquico",
      "outros",
    ]),
    severidade: z.number().int().min(1).max(5),
    escalonado_para: z.string().trim().max(160).optional(),
    notas: z.string().trim().max(2000).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }

  // ─── 1. Ler RAW body ─────────────────────────────────────────────────────
  // Crítico: HMAC é calculado sobre os bytes exatos. Não use req.json().
  const raw = await req.text();

  // ─── 2. Timestamp anti-replay ────────────────────────────────────────────
  const tsHeader = req.headers.get(TIMESTAMP_HEADER);
  if (!verifyTimestamp(tsHeader)) {
    return NextResponse.json(
      { erro: "assinatura_invalida", detalhe: "timestamp ausente ou fora da janela" },
      { status: 401 },
    );
  }

  // ─── 3. Parse JSON ───────────────────────────────────────────────────────
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  // ─── 4. Descobre clinica_id (probe mínimo) para resolver o segredo ───────
  const probe = (json ?? {}) as { clinica_id?: unknown };
  const clinicaIdProbe =
    typeof probe.clinica_id === "string" ? probe.clinica_id.trim() : null;
  if (!clinicaIdProbe) {
    return NextResponse.json(
      { erro: "schema_invalido", detalhe: "clinica_id ausente" },
      { status: 400 },
    );
  }

  // ─── 5. Resolve segredo e confere fingerprint no DB ──────────────────────
  const segredo = await lookupSecretAsync(clinicaIdProbe);
  if (!segredo) {
    return NextResponse.json(
      { erro: "assinatura_invalida", detalhe: "segredo não provisionado" },
      { status: 401 },
    );
  }

  const [clin] = await sqlAdmin<
    { empresa_id: string; ativa: boolean; webhook_secret_hash: string }[]
  >`
    select empresa_id, ativa, webhook_secret_hash
      from public.clinicas
     where id = ${clinicaIdProbe}
     limit 1
  `;
  if (!clin) {
    return NextResponse.json({ erro: "Clínica desconhecida" }, { status: 404 });
  }
  if (!clin.ativa) {
    return NextResponse.json(
      { erro: "Clínica desconhecida ou inativa" },
      { status: 401 },
    );
  }
  if (fingerprint(segredo) !== clin.webhook_secret_hash) {
    return NextResponse.json(
      { erro: "assinatura_invalida", detalhe: "fingerprint divergente" },
      { status: 401 },
    );
  }

  // ─── 6. Verifica HMAC sobre o body raw ───────────────────────────────────
  const sigHeader = req.headers.get(SIGNATURE_HEADER);
  if (!verifySignature(raw, sigHeader, segredo)) {
    return NextResponse.json(
      { erro: "assinatura_invalida" },
      { status: 401 },
    );
  }

  // ─── 7. Validação Zod (após HMAC OK — mantém 422 do contrato) ────────────
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        erro: "Payload inválido",
        detalhe: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 422 },
    );
  }
  const d = parsed.data;

  // Defesa em profundidade: o clinica_id no body precisa bater com o que
  // assinou (já garantido pelo HMAC sobre raw, mas explicitamos).
  if (d.clinica_id !== clinicaIdProbe) {
    return NextResponse.json(
      { erro: "assinatura_invalida", detalhe: "clinica_id divergente" },
      { status: 401 },
    );
  }

  const empresaId = clin.empresa_id;

  try {
    const evento = await criarEvento(empresaId, {
      clinica_id: d.clinica_id,
      marcador_anonimo: d.marcador_anonimo,
      tipo: d.tipo,
      severidade: d.severidade,
      escalonado_para: d.escalonado_para,
      notas: d.notas,
    });

    // Notificação ao DPO/SST — persiste na trilha e despacha pros canais
    // configurados (e-mail/Slack). NUNCA contém PII (só tipo/severidade/id).
    // notificar() é fail-safe: não lança, não derruba o registro do evento.
    await notificar({
      tipo: "risco_grave",
      empresa_id: empresaId,
      titulo: `Risco grave/iminente: ${d.tipo}`,
      corpo:
        `Evento de risco grave registrado (severidade ${d.severidade}/5). ` +
        `Acesse o painel de Riscos para acompanhar e encerrar. ` +
        `Ref. evento: ${evento.id}.`,
    });

    return NextResponse.json(
      { ok: true, id: evento.id, status: evento.status, criado_em: evento.criado_em },
      { status: 201 },
    );
  } catch (e) {
    console.error("[risco-grave] erro ao persistir", e);
    return NextResponse.json({ erro: "Falha ao registrar evento" }, { status: 500 });
  }
}
