/**
 * PATCH /api/admin/empresas/[id]
 *   Atualiza campos da empresa (nome, cnpj, segmento) e/ou ativa/desativa.
 *
 * Gate: somente papel `admin`. Body validado com Zod .strict() na lib
 * (atualizarEmpresaSchema).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSessao } from "@/lib/auth";
import { atualizarEmpresa, statusDoErro } from "@/lib/admin-gestao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = getSessao();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.papel !== "admin") return NextResponse.json({ erro: "Apenas Admin" }, { status: 403 });

  const id = params.id?.trim();
  if (!id) return NextResponse.json({ erro: "id ausente" }, { status: 400 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const res = await atualizarEmpresa(id, json as never);
  if (!res.ok) {
    return NextResponse.json(
      { erro: res.erro, detalhe: res.detalhe },
      { status: statusDoErro(res.erro) },
    );
  }
  return NextResponse.json({ ok: true, empresa: res.data });
}
