/**
 * PATCH /api/notificacoes/[id]/lida
 *   Marca UMA notificação como lida (lida_em = now()).
 *
 * Gated sst|admin. Para sst, o escopo de empresa é aplicado: só marca se a
 * notificação pertencer à empresa da sessão (impede marcar a de outro tenant);
 * admin marca qualquer uma. Idempotente.
 *
 * Resposta: { ok: true } se marcada; 404 se não existe / fora do escopo.
 */

import { NextResponse, type NextRequest } from "next/server";
import { dbHabilitado } from "@/lib/db";
import { getSessao } from "@/lib/auth";
import { marcarLida } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["sst", "admin"]);

export async function PATCH(
  _req: NextRequest,
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

  const id = params.id?.trim();
  if (!id) return NextResponse.json({ erro: "id_ausente" }, { status: 400 });

  // sst → escopo por empresa; admin → sem escopo.
  const escopo = sessao.papel === "admin" ? undefined : sessao.empresa_id;

  try {
    const ok = await marcarLida(id, escopo);
    if (!ok) return NextResponse.json({ erro: "nao_encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Zod (uuid inválido) → 400; demais → 500.
    if (e instanceof Error && e.name === "ZodError") {
      return NextResponse.json({ erro: "id_invalido" }, { status: 400 });
    }
    console.error("[/api/notificacoes/[id]/lida] PATCH erro:", e);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
