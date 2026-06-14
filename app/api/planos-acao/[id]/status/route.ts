/**
 * PATCH /api/planos-acao/:id/status
 *
 * Atualiza o status do plano de ação. Restrito a sst|admin.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessao } from "@/lib/auth";
import { atualizarStatusPlano } from "@/lib/plano-acao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["sst", "admin"]);

const Body = z
  .object({
    status: z.enum(["pendente", "em_andamento", "concluido", "cancelado"]),
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
  if (!PAPEIS.has(sessao.papel)) {
    return NextResponse.json(
      { erro: "Apenas Gestor SST ou Admin podem alterar planos" },
      { status: 403 },
    );
  }

  const id = params.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ erro: "ID inválido" }, { status: 400 });
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
        erro: "Dados inválidos",
        detalhe: parsed.error.issues.map((i) => i.message),
      },
      { status: 422 },
    );
  }

  try {
    const plano = await atualizarStatusPlano(
      sessao.empresa_id,
      id,
      parsed.data.status,
    );
    if (!plano) {
      return NextResponse.json({ erro: "Plano não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: plano });
  } catch (e) {
    console.error("[planos-acao/status] erro", e);
    return NextResponse.json({ erro: "Falha ao atualizar status" }, { status: 500 });
  }
}
