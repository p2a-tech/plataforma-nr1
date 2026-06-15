/**
 * /api/admin/empresas
 *   GET  → lista empresas (com contagem de usuários). Filtros: q, ativa.
 *   POST → cria empresa (id slug gerado se ausente).
 *
 * Gate: somente papel `admin` (gestão cross-tenant pelo Console Admin da P2A).
 * Body validado com Zod .strict() na lib (criarEmpresaSchema).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSessao } from "@/lib/auth";
import { listarEmpresas, criarEmpresa, statusDoErro } from "@/lib/admin-gestao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gateAdmin() {
  const sessao = getSessao();
  if (!sessao) return { erro: NextResponse.json({ erro: "Não autenticado" }, { status: 401 }) };
  if (sessao.papel !== "admin")
    return { erro: NextResponse.json({ erro: "Apenas Admin" }, { status: 403 }) };
  return { sessao };
}

export async function GET(req: NextRequest) {
  const g = gateAdmin();
  if (g.erro) return g.erro;

  const sp = req.nextUrl.searchParams;
  const ativaRaw = sp.get("ativa");
  const empresas = await listarEmpresas({
    q: sp.get("q") ?? undefined,
    ativa: ativaRaw === "true" ? true : ativaRaw === "false" ? false : undefined,
  });
  return NextResponse.json({ ok: true, empresas });
}

export async function POST(req: NextRequest) {
  const g = gateAdmin();
  if (g.erro) return g.erro;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const res = await criarEmpresa(json as never);
  if (!res.ok) {
    return NextResponse.json(
      { erro: res.erro, detalhe: res.detalhe },
      { status: statusDoErro(res.erro) },
    );
  }
  return NextResponse.json({ ok: true, empresa: res.data }, { status: 201 });
}
