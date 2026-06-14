/**
 * GET /api/catalogo/papeis?q=psico
 *
 * Endpoint público (sem auth) — catálogo global de cargos clínicos.
 * Alimenta o autocomplete da Q2 do formulário público DRPS.
 *
 * Query string:
 *   - q (opcional): substring case-insensitive a buscar em `nome`.
 *
 * Resposta:
 *   { cargos: [{ id, nome, area, conselho_profissional? }, ...] }
 *
 * Cacheável (catálogo estável). max-age=3600 (1h) — pra atualizar antes,
 * basta re-deploy com nova migration.
 */

import { NextResponse, type NextRequest } from "next/server";
import { dbHabilitado } from "@/lib/db";
import { matchPorTexto } from "@/lib/catalogo-papeis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json(
      { erro: "banco_indisponivel" },
      { status: 503 },
    );
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);

  try {
    const cargos = await matchPorTexto(q, 12);
    const body = {
      cargos: cargos.map((c) => ({
        id: c.id,
        nome: c.nome,
        area: c.area,
        conselho_profissional: c.conselho_profissional ?? undefined,
      })),
    };
    return NextResponse.json(body, {
      headers: {
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { erro: "falha_buscar_papeis", detalhe: msg },
      { status: 500 },
    );
  }
}
