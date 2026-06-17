/**
 * GET /api/notificacoes
 *   Lista as notificações in-app visíveis ao usuário + a contagem de não lidas.
 *
 * Gated sst|admin (clínica não tem acesso). Escopo por empresa aplicado na lib
 * (sst só vê da própria empresa e nunca reset_senha; admin vê todas).
 *
 * Query params (todos opcionais):
 *   - tipos=risco_grave,dsar       (CSV; filtra os tipos — intersectado com os
 *                                   permitidos ao papel na lib)
 *   - nao_lidas=1                  (só não lidas)
 *   - limit, offset                (paginação; clamp na lib: limit 1..200)
 *
 * Resposta: { ok, notificacoes: [...], naoLidas: number }
 */

import { NextResponse, type NextRequest } from "next/server";
import { dbHabilitado } from "@/lib/db";
import { getSessao } from "@/lib/auth";
import {
  listarNotificacoes,
  contarNaoLidas,
} from "@/lib/notificacoes";
import type { TipoNotificacao } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["sst", "admin"]);
const TIPOS_VALIDOS: readonly TipoNotificacao[] = [
  "risco_grave",
  "dsar",
  "reset_senha",
  "generico",
];

function parseTipos(raw: string | null): TipoNotificacao[] | undefined {
  if (!raw) return undefined;
  const out = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TipoNotificacao =>
      (TIPOS_VALIDOS as readonly string[]).includes(s),
    );
  return out.length ? out : undefined;
}

function parseInt0(raw: string | null): number | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }
  const sessao = getSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!PAPEIS.has(sessao.papel)) {
    return NextResponse.json({ erro: "papel_nao_autorizado" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const tipos = parseTipos(sp.get("tipos"));
  const apenasNaoLidas = ["1", "true", "sim"].includes(
    (sp.get("nao_lidas") ?? "").toLowerCase(),
  );
  const limit = parseInt0(sp.get("limit"));
  const offset = parseInt0(sp.get("offset"));

  try {
    const [notificacoes, naoLidas] = await Promise.all([
      listarNotificacoes({
        empresaId: sessao.empresa_id,
        papel: sessao.papel,
        tipos,
        apenasNaoLidas,
        ...(limit != null ? { limit } : {}),
        ...(offset != null ? { offset } : {}),
      }),
      contarNaoLidas(sessao.empresa_id, sessao.papel),
    ]);
    return NextResponse.json({ ok: true, notificacoes, naoLidas });
  } catch (e) {
    console.error("[/api/notificacoes] GET erro:", e);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
