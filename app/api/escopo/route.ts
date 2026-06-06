/**
 * POST /api/escopo  → define a empresa em foco da Diretoria (cookie).
 * body: { empresa: "global" | "<empresa_id>" }. Restrito a diretoria|admin.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSessao } from "@/lib/auth";
import { COOKIE_ESCOPO } from "@/lib/escopo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ empresa: z.string().min(1).max(64) });

export async function POST(req: NextRequest) {
  const s = getSessao();
  if (!s || (s.papel !== "diretoria" && s.papel !== "admin")) {
    return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ erro: "empresa inválida" }, { status: 422 });

  cookies().set(COOKIE_ESCOPO, parsed.data.empresa, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return NextResponse.json({ ok: true, empresa: parsed.data.empresa });
}
