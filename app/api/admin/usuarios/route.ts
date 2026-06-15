/**
 * /api/admin/usuarios
 *   GET  → lista usuários (join empresa/clínica). Filtros: empresa_id, papel, q.
 *   POST → cria usuário. Retorna a senha temporária UMA vez no response (para
 *          o admin copiar) — ela nunca é re-exibida depois.
 *
 * Gate: somente papel `admin`. Body validado com Zod .strict() na lib
 * (criarUsuarioSchema). A senha é hasheada (bcrypt) na lib.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSessao } from "@/lib/auth";
import {
  listarUsuarios,
  criarUsuario,
  gerarSenhaTemporaria,
  statusDoErro,
  PAPEIS_VALIDOS,
  type Papel,
} from "@/lib/admin-gestao";

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
  const papelRaw = sp.get("papel");
  const papel = (PAPEIS_VALIDOS as readonly string[]).includes(papelRaw ?? "")
    ? (papelRaw as Papel)
    : undefined;

  const usuarios = await listarUsuarios({
    empresa_id: sp.get("empresa_id") ?? undefined,
    papel,
    q: sp.get("q") ?? undefined,
  });
  return NextResponse.json({ ok: true, usuarios });
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

  // Se o admin não enviar senha, geramos uma temporária aqui.
  const body = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const senhaTemporaria =
    typeof body.senhaTemporaria === "string" && body.senhaTemporaria.length > 0
      ? body.senhaTemporaria
      : gerarSenhaTemporaria();

  const res = await criarUsuario(
    { ...body, senhaTemporaria } as never,
    g.sessao?.email ?? null,
  );
  if (!res.ok) {
    return NextResponse.json(
      { erro: res.erro, detalhe: res.detalhe },
      { status: statusDoErro(res.erro) },
    );
  }
  // Retorna a senha temporária UMA vez — o admin copia e repassa ao usuário.
  return NextResponse.json(
    { ok: true, usuario: res.data, senhaTemporaria },
    { status: 201 },
  );
}
