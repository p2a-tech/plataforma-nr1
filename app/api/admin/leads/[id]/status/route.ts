/**
 * PATCH /api/admin/leads/[id]/status — transição de status de um lead no pipeline.
 *
 * Gate: somente papel `admin` (a fila de leads é cross-tenant, acessada apenas
 * pelo Console Admin da P2A). Body validado com Zod strict.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessao } from "@/lib/auth";
import { atualizarStatusLead, STATUS_VALIDOS } from "@/lib/queries-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    status: z.enum(STATUS_VALIDOS as unknown as [string, ...string[]]),
    notas: z.string().trim().max(2000).optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sessao = getSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }
  if (sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas Admin pode alterar leads" },
      { status: 403 },
    );
  }

  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ erro: "id ausente" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        erro: "validacao",
        detalhe: parsed.error.issues.map((i) => i.message),
      },
      { status: 422 },
    );
  }

  const { status, notas } = parsed.data;
  const res = await atualizarStatusLead(id, {
    status: status as (typeof STATUS_VALIDOS)[number],
    notas,
  });
  if (!res.ok) {
    return NextResponse.json({ erro: "lead_nao_encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lead: res.row });
}
