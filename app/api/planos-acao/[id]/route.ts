/**
 * PATCH /api/planos-acao/:id
 *
 * Edita responsável e/ou prazo de um plano de ação (Onda 9). Restrito a
 * sst|admin. Para mudar STATUS, use /api/planos-acao/:id/status.
 *
 * Body (ao menos um campo):
 *   - responsavel?: string (1..160)
 *   - prazo?: 'YYYY-MM-DD' | null  (null limpa o prazo)
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessao } from "@/lib/auth";
import { editarPlano } from "@/lib/plano-acao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["sst", "admin"]);

const Body = z
  .object({
    responsavel: z.string().trim().min(1).max(160).optional(),
    prazo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use formato YYYY-MM-DD")
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (d) => d.responsavel !== undefined || d.prazo !== undefined,
    { message: "Informe responsavel e/ou prazo" },
  );

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
      { erro: "Apenas Gestor SST ou Admin podem editar planos" },
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
    const plano = await editarPlano(sessao.empresa_id, id, {
      responsavel: parsed.data.responsavel,
      // Só repassa `prazo` se a chave foi enviada (distingue null de ausente).
      ...(Object.prototype.hasOwnProperty.call(parsed.data, "prazo")
        ? { prazo: parsed.data.prazo ?? null }
        : {}),
    });
    if (!plano) {
      return NextResponse.json({ erro: "Plano não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: plano });
  } catch (e) {
    console.error("[planos-acao/editar] erro", e);
    return NextResponse.json({ erro: "Falha ao editar plano" }, { status: 500 });
  }
}
