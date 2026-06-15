/**
 * PATCH /api/colaboradores/:id
 *
 * Ativa/desativa ou edita campos (nome, matrícula, setor, cargo, ativo) de um
 * colaborador do quadro de RH. Gated sst|admin · tenant-scoped (RLS).
 *
 * Body (qualquer subconjunto):
 *   { ativo?: boolean, nome?: string, matricula?: string, setor?: string, cargo?: string }
 */

import { NextResponse, type NextRequest } from "next/server";
import { dbHabilitado } from "@/lib/db";
import { getSessao } from "@/lib/auth";
import {
  AtualizarColaboradorSchema,
  atualizarColaborador,
  setAtivo,
} from "@/lib/colaboradores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["sst", "admin"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }
  const sessao = getSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!PAPEIS.has(sessao.papel)) {
    return NextResponse.json({ erro: "papel_nao_autorizado" }, { status: 403 });
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
  const parsed = AtualizarColaboradorSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "schema_invalido", detalhes: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    // Atalho: corpo só com {ativo} usa setAtivo (toggle direto).
    const keys = Object.keys(parsed.data);
    const item =
      keys.length === 1 && keys[0] === "ativo"
        ? await setAtivo(sessao.empresa_id, id, parsed.data.ativo as boolean)
        : await atualizarColaborador(sessao.empresa_id, id, parsed.data);

    if (!item) {
      return NextResponse.json({ erro: "nao_encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("[/api/colaboradores/:id] PATCH erro:", e);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
