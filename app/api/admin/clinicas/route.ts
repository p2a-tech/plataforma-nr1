/**
 * /api/admin/clinicas
 *   GET  → lista clínicas parceiras (filtro opcional ?empresa_id=).
 *   POST → cria clínica (id slug gerado se ausente).
 *
 * Gate: somente papel `admin` (onboarding de parceiro pelo Console Admin da P2A).
 * Body validado com Zod .strict() na lib (criarClinicaSchema).
 *
 * IMPORTANTE: o POST devolve `segredoWebhook` UMA ÚNICA VEZ. O banco guarda só
 * o sha256 (webhook_secret_hash) — o segredo cru deve ser copiado e guardado no
 * perímetro da clínica (env/secret manager). Não há como recuperá-lo depois.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSessao } from "@/lib/auth";
import { listarClinicas, criarClinica, statusDoErro } from "@/lib/admin-gestao";

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

  const empresaId = req.nextUrl.searchParams.get("empresa_id") ?? undefined;
  const clinicas = await listarClinicas(empresaId);
  return NextResponse.json({ ok: true, clinicas });
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

  const res = await criarClinica(json as never);
  if (!res.ok) {
    return NextResponse.json(
      { erro: res.erro, detalhe: res.detalhe },
      { status: statusDoErro(res.erro) },
    );
  }
  // segredoWebhook vai só nesta resposta (nunca mais é recuperável).
  return NextResponse.json({ ok: true, clinica: res.data }, { status: 201 });
}
