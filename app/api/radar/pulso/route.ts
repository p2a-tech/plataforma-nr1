/**
 * POST /api/radar/pulso → ingere UMA resposta anônima de micro-pulso.
 *
 * Channel-agnostic: WhatsApp, app interno e totem/QR postam aqui. Não há PII
 * nem id de pessoa — só o cluster (Setor × Turno), energia e (opcional) ofensor.
 * A privacidade individual é preservada na LEITURA (k-anonymity, k≥7).
 */

import { NextResponse, type NextRequest } from "next/server";
import { PulsoResposta } from "@/lib/radar";
import { sql, dbHabilitado } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";
import { rateLimit, clientIp, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!dbHabilitado) return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });

  // Anti-abuso: 60 respostas / min por IP (canal-agnóstico).
  const rl = rateLimit(rateLimitKey(["pulso", clientIp(req)]), { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { erro: "Limite de requisições excedido" },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  const parsed = PulsoResposta.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Resposta inválida", detalhe: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }
  const p = parsed.data;

  try {
    const row = await withEmpresa(p.empresa_id, async () => {
      const [r] = await sql<{ id: string }[]>`
        insert into public.pulso_respostas
          (empresa_id, cluster_setor, cluster_turno, cluster_site, canal, energia, ofensor, duracao_seg)
        values
          (${p.empresa_id}, ${p.cluster_setor}, ${p.cluster_turno}, ${p.cluster_site ?? null},
           ${p.canal}, ${p.energia}, ${p.ofensor ?? null}, ${p.duracao_seg ?? null})
        returning id
      `;
      return r;
    });
    return NextResponse.json({ ok: true, id: row.id }, { status: 200 });
  } catch (e) {
    console.error("[radar/pulso] erro ao gravar", e);
    return NextResponse.json({ erro: "Falha ao registrar resposta" }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({
    endpoint: "radar/pulso",
    status: "ready",
    descricao: "POST { cluster_setor, cluster_turno, energia(1-5), ofensor?, canal? }",
  });
}
