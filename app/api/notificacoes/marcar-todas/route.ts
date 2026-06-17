/**
 * POST /api/notificacoes/marcar-todas
 *   Marca TODAS as notificações não lidas visíveis ao usuário como lidas.
 *
 * Gated sst|admin. Escopo na lib: sst só marca as da própria empresa e dos tipos
 * permitidos; admin marca todas as não lidas.
 *
 * Resposta: { ok: true, marcadas: number }
 */

import { NextResponse } from "next/server";
import { dbHabilitado } from "@/lib/db";
import { getSessao } from "@/lib/auth";
import { marcarTodasLidas } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["sst", "admin"]);

export async function POST() {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }
  const sessao = getSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!PAPEIS.has(sessao.papel)) {
    return NextResponse.json({ erro: "papel_nao_autorizado" }, { status: 403 });
  }

  try {
    const marcadas = await marcarTodasLidas(sessao.empresa_id, sessao.papel);
    return NextResponse.json({ ok: true, marcadas });
  } catch (e) {
    console.error("[/api/notificacoes/marcar-todas] POST erro:", e);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
