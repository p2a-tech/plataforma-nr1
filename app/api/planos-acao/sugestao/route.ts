/**
 * GET /api/planos-acao/sugestao?fator_id=...&classificacao=...
 *
 * Lista as ações recomendadas do catálogo apropriadas para um fator e uma
 * classificação. Usado pelo drawer de plano em /riscos.
 *
 * Restrito a sst|admin — só a empresa consulta seu catálogo de planos
 * (catálogo em si é global, mas a chamada usa empresa_id pra resolver a
 * dimensão dentro do escopo certo).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessao } from "@/lib/auth";
import { sugerirPlano } from "@/lib/plano-acao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["sst", "admin"]);

const Query = z.object({
  fator_id: z.string().trim().min(1).max(80),
  classificacao: z.enum(["baixo", "moderado", "alto"]),
});

export async function GET(req: NextRequest) {
  const sessao = getSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }
  if (!PAPEIS.has(sessao.papel)) {
    return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    fator_id: url.searchParams.get("fator_id"),
    classificacao: url.searchParams.get("classificacao"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Parâmetros inválidos", detalhe: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  try {
    const itens = await sugerirPlano(
      sessao.empresa_id,
      parsed.data.fator_id,
      parsed.data.classificacao,
    );
    return NextResponse.json({ itens });
  } catch (e) {
    console.error("[planos-acao/sugestao] erro", e);
    return NextResponse.json({ erro: "Falha ao sugerir plano" }, { status: 500 });
  }
}
