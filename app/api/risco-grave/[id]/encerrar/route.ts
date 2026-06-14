/**
 * PATCH /api/risco-grave/:id/encerrar
 *
 * Encerra um evento de risco grave/iminente. Restrito a sst|admin (a clínica
 * acompanha pelo próprio sistema, mas o encerramento na PrevIA é decisão da
 * empresa/DPO).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessao } from "@/lib/auth";
import { encerrarEvento } from "@/lib/risco-grave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["sst", "admin"]);

const Body = z
  .object({
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
  if (!PAPEIS.has(sessao.papel)) {
    return NextResponse.json(
      { erro: "Apenas Gestor SST ou Admin podem encerrar eventos" },
      { status: 403 },
    );
  }

  const id = params.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ erro: "ID inválido" }, { status: 400 });
  }

  let json: unknown = {};
  if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
    }
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos", detalhe: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }

  try {
    const evento = await encerrarEvento(sessao.empresa_id, id, parsed.data.notas);
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: evento });
  } catch (e) {
    console.error("[risco-grave/encerrar] erro", e);
    return NextResponse.json({ erro: "Falha ao encerrar evento" }, { status: 500 });
  }
}
