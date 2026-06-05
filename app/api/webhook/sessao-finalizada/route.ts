/**
 * POST /api/webhook/sessao-finalizada
 *
 * Endpoint que a clínica parceira chama ao final de cada atendimento.
 * Esta rota é a FRONTEIRA — depois daqui, dado sensível não atravessa.
 *
 * Camadas de defesa (em ordem):
 *   1. Timestamp anti-replay (janela de 300s).
 *   2. HMAC SHA-256 com segredo compartilhado (timingSafeEqual).
 *   3. Fingerprint do segredo bate com o registrado no DB pra essa clínica.
 *   4. Lista negra de campos PROIBIDOS (mensagem clara pro DPO).
 *   5. Schema Zod com `.strict()` em todo o payload.
 *   6. Idempotência por (clinica_id, session_id_anon).
 *   7. Audit log SEM payload (só metadados).
 *
 * Toda rejeição vira uma linha no audit log com o motivo.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  validarPayload,
  type SessaoFinalizadaPayload,
  type WebhookResposta,
} from "@previa/contracts";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
  verifyTimestamp,
  signPayload,
} from "@previa/contracts/signing";
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";
import { lookupSecret, fingerprint } from "@/lib/clinic-secrets";

export const runtime = "nodejs"; // node:crypto e Postgres.js precisam do runtime Node
export const dynamic = "force-dynamic";

interface LinhaAudit {
  clinica_id: string | null;
  empresa_id: string | null;
  resultado: "aceito" | "rejeitado";
  motivo: string | null;
  assinatura_valida: boolean;
  ip_origem: string | null;
  payload_size_bytes: number;
  latency_ms: number;
}

async function registrarAudit(linha: LinhaAudit) {
  if (!dbHabilitado) return;
  try {
    // Fallback: se ainda não conhecemos a empresa (rejeição antes de identificar
    // a clínica), gravamos numa pseudo-empresa de "auditoria sem escopo".
    // FK aponta para 'emp_unscoped' que pode ser inserida no seed/migration.
    const empresa = linha.empresa_id ?? "emp_unscoped";
    await sql`
      insert into public.webhook_audit_log
        (empresa_id, clinica_id, resultado, motivo, assinatura_valida,
         ip_origem, payload_size_bytes, latency_ms)
      values
        (${empresa}, ${linha.clinica_id}, ${linha.resultado}, ${linha.motivo},
         ${linha.assinatura_valida}, ${linha.ip_origem},
         ${linha.payload_size_bytes}, ${linha.latency_ms})
    `;
  } catch (e) {
    // Log falhou — não bloqueia a resposta. Em produção, mandar pra Sentry.
    console.error("[webhook] falha ao gravar audit log", e);
  }
}

type MotivoRejeicao = Extract<WebhookResposta, { status: "rejeitado" }>["motivo"];

function rejeitar(
  status: number,
  motivo: MotivoRejeicao,
  detalhe?: string,
): NextResponse<WebhookResposta> {
  return NextResponse.json<WebhookResposta>(
    { status: "rejeitado", motivo, detalhe },
    { status },
  );
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const ipOrigem =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // ─── 1. Ler RAW body ─────────────────────────────────────────────────────
  // Crítico: o HMAC foi calculado sobre os bytes exatos. Não use req.json().
  const rawBody = await req.text();
  const tamanho = rawBody.length;

  // ─── 2. Timestamp anti-replay ────────────────────────────────────────────
  const tsHeader = req.headers.get(TIMESTAMP_HEADER);
  if (!verifyTimestamp(tsHeader)) {
    await registrarAudit({
      clinica_id: null,
      empresa_id: null,
      resultado: "rejeitado",
      motivo: "timestamp_invalido_ou_expirado",
      assinatura_valida: false,
      ip_origem: ipOrigem,
      payload_size_bytes: tamanho,
      latency_ms: Date.now() - t0,
    });
    return rejeitar(401, "assinatura_invalida", "timestamp inválido ou fora da janela");
  }

  // ─── 3. Parse mínimo só pra descobrir clinica_id ─────────────────────────
  let probe: { clinica_id?: unknown } = {};
  try {
    probe = JSON.parse(rawBody);
  } catch {
    await registrarAudit({
      clinica_id: null,
      empresa_id: null,
      resultado: "rejeitado",
      motivo: "json_invalido",
      assinatura_valida: false,
      ip_origem: ipOrigem,
      payload_size_bytes: tamanho,
      latency_ms: Date.now() - t0,
    });
    return rejeitar(400, "schema_invalido", "JSON malformado");
  }

  const clinicaId = typeof probe.clinica_id === "string" ? probe.clinica_id : null;
  if (!clinicaId) {
    await registrarAudit({
      clinica_id: null,
      empresa_id: null,
      resultado: "rejeitado",
      motivo: "clinica_id_ausente",
      assinatura_valida: false,
      ip_origem: ipOrigem,
      payload_size_bytes: tamanho,
      latency_ms: Date.now() - t0,
    });
    return rejeitar(400, "schema_invalido", "clinica_id ausente");
  }

  // ─── 4. Recuperar segredo da clínica + checar fingerprint no DB ──────────
  const segredo = lookupSecret(clinicaId);
  if (!segredo) {
    await registrarAudit({
      clinica_id: clinicaId,
      empresa_id: null,
      resultado: "rejeitado",
      motivo: "segredo_nao_provisionado",
      assinatura_valida: false,
      ip_origem: ipOrigem,
      payload_size_bytes: tamanho,
      latency_ms: Date.now() - t0,
    });
    return rejeitar(401, "clinica_desconhecida");
  }

  if (!dbHabilitado) {
    return rejeitar(503, "clinica_desconhecida", "DB não configurado no servidor");
  }

  const [clinicaRow] = await sql<
    { id: string; webhook_secret_hash: string; ativa: boolean; empresa_id: string }[]
  >`
    select id, webhook_secret_hash, ativa, empresa_id
      from public.clinicas
     where id = ${clinicaId}
     limit 1
  `;

  if (!clinicaRow || !clinicaRow.ativa) {
    await registrarAudit({
      clinica_id: clinicaId,
      empresa_id: clinicaRow?.empresa_id ?? null,
      resultado: "rejeitado",
      motivo: "clinica_inativa_ou_inexistente",
      assinatura_valida: false,
      ip_origem: ipOrigem,
      payload_size_bytes: tamanho,
      latency_ms: Date.now() - t0,
    });
    return rejeitar(401, "clinica_desconhecida");
  }

  if (fingerprint(segredo) !== clinicaRow.webhook_secret_hash) {
    await registrarAudit({
      clinica_id: clinicaId,
      empresa_id: clinicaRow?.empresa_id ?? null,
      resultado: "rejeitado",
      motivo: "fingerprint_divergente",
      assinatura_valida: false,
      ip_origem: ipOrigem,
      payload_size_bytes: tamanho,
      latency_ms: Date.now() - t0,
    });
    return rejeitar(401, "assinatura_invalida", "fingerprint do segredo divergente");
  }

  // ─── 5. Verificar HMAC ──────────────────────────────────────────────────
  const sigHeader = req.headers.get(SIGNATURE_HEADER);
  if (!verifySignature(rawBody, sigHeader, segredo)) {
    await registrarAudit({
      clinica_id: clinicaId,
      empresa_id: clinicaRow?.empresa_id ?? null,
      resultado: "rejeitado",
      motivo: "hmac_invalido",
      assinatura_valida: false,
      ip_origem: ipOrigem,
      payload_size_bytes: tamanho,
      latency_ms: Date.now() - t0,
    });
    return rejeitar(401, "assinatura_invalida");
  }

  // ─── 6. Validar payload (lista negra + Zod strict) ──────────────────────
  const validacao = validarPayload(probe);
  if (!validacao.ok) {
    await registrarAudit({
      clinica_id: clinicaId,
      empresa_id: clinicaRow?.empresa_id ?? null,
      resultado: "rejeitado",
      motivo: validacao.motivo,
      assinatura_valida: true, // HMAC era válido — o conteúdo é que rompe a barreira
      ip_origem: ipOrigem,
      payload_size_bytes: tamanho,
      latency_ms: Date.now() - t0,
    });
    return rejeitar(
      422,
      validacao.motivo === "campos_proibidos" ? "campos_proibidos" : "schema_invalido",
      validacao.erros.slice(0, 3).join(" · "),
    );
  }

  const payload: SessaoFinalizadaPayload = validacao.payload;

  // ─── 7. Insert idempotente + ofensores ───────────────────────────────────
  let eventoId: string;
  try {
    const [evento] = await sql<{ id: string; inserted: boolean }[]>`
      with novo as (
        insert into public.eventos_agregados
          (empresa_id, clinica_id, session_id_anon, iniciada_em, duracao_minutos,
           cluster_setor, cluster_turno, cluster_site,
           severidade_estimada, protocolo_emergencia, versao_extractor)
        values
          (${clinicaRow.empresa_id}, ${payload.clinica_id}, ${payload.session_id_anon},
           ${payload.iniciada_em}, ${payload.duracao_minutos},
           ${payload.cluster.setor}, ${payload.cluster.turno},
           ${payload.cluster.site ?? null},
           ${payload.severidade_estimada},
           ${payload.protocolo_emergencia_acionado},
           ${payload.versao_extractor})
        on conflict (clinica_id, session_id_anon) do nothing
        returning id
      )
      select id, true as inserted from novo
      union all
      select id, false as inserted
        from public.eventos_agregados
       where clinica_id = ${payload.clinica_id}
         and session_id_anon = ${payload.session_id_anon}
       limit 1
    `;
    eventoId = evento.id;

    if (evento.inserted && payload.ofensores.length > 0) {
      // Bulk insert dos ofensores
      await sql`
        insert into public.ofensores_evento ${sql(
          payload.ofensores.map((o) => ({
            evento_id: eventoId,
            tag: o.tag,
            confidence: o.confidence,
            ocorrencias: o.ocorrencias ?? null,
          })),
        )}
      `;
    }
  } catch (e) {
    console.error("[webhook] erro ao persistir evento", e);
    await registrarAudit({
      clinica_id: clinicaId,
      empresa_id: clinicaRow?.empresa_id ?? null,
      resultado: "rejeitado",
      motivo: "erro_persistencia",
      assinatura_valida: true,
      ip_origem: ipOrigem,
      payload_size_bytes: tamanho,
      latency_ms: Date.now() - t0,
    });
    return NextResponse.json<WebhookResposta>(
      { status: "rejeitado", motivo: "duplicado", detalhe: "falha de persistência" },
      { status: 500 },
    );
  }

  const latency = Date.now() - t0;
  await registrarAudit({
    clinica_id: clinicaId,
      empresa_id: clinicaRow?.empresa_id ?? null,
    resultado: "aceito",
    motivo: null,
    assinatura_valida: true,
    ip_origem: ipOrigem,
    payload_size_bytes: tamanho,
    latency_ms: latency,
  });

  return NextResponse.json<WebhookResposta>(
    {
      status: "aceito",
      evento_id: eventoId,
      recebido_em: new Date().toISOString(),
    },
    { status: 200 },
  );
}

/** GET: ping de saúde do endpoint (não retorna segredo nem fingerprint). */
export async function GET() {
  return NextResponse.json({
    endpoint: "sessao-finalizada",
    status: "ready",
    contrato: {
      headers_obrigatorios: [SIGNATURE_HEADER, TIMESTAMP_HEADER],
      janela_skew_segundos: 300,
      content_type: "application/json",
    },
    exemplo_signature: signPayload(
      '{"hello":"world"}',
      "exemplo-secret-NUNCA-use",
    ),
  });
}
