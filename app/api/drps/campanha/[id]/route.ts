/**
 * PATCH /api/drps/campanha/[id] — ativa/desativa uma campanha DRPS.
 *
 * Onda 5 · Dev B · §8. Mantém o histórico de respostas vinculadas; apenas
 * fecha (ou reabre) a coleta de novas respostas via token.
 *
 * Body: { ativo: boolean }.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessao } from "@/lib/auth";
import { dbHabilitado } from "@/lib/db";
import {
  desativarCampanha,
  reativarCampanha,
} from "@/lib/drps-campanha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ ativo: z.boolean() }).strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "banco_indisponivel" }, { status: 503 });
  }
  const s = getSessao();
  if (!s) {
    return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  }
  if (s.papel !== "sst" && s.papel !== "admin") {
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });
  }

  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ erro: "id_ausente" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "json_invalido" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "schema_invalido", detalhes: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const empresaId = s.empresa_id;
  const ok = parsed.data.ativo
    ? await reativarCampanha(empresaId, id)
    : await desativarCampanha(empresaId, id);
  if (!ok) {
    return NextResponse.json({ erro: "campanha_nao_encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
