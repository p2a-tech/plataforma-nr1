/**
 * POST /api/atendimento/analisar
 *
 * Recebe a transcrição corrente (parcial ou final) de um atendimento e devolve
 * a análise estruturada da IA: ofensores organizacionais (taxonomia canônica),
 * severidade estimada, notas sugeridas e bandeira de risco grave.
 *
 * Roda no perímetro da clínica (server-side). A transcrição é processada e
 * descartada — não é persistida aqui. Só o resultado estruturado importa para
 * o passo seguinte (montar o payload agregado que cruza a barreira).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { analisarTranscricao } from "@/lib/extraction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  transcricao: z.string().max(50_000),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Payload inválido", detalhe: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }

  try {
    const resultado = await analisarTranscricao(parsed.data.transcricao);
    return NextResponse.json(resultado, { status: 200 });
  } catch (e) {
    console.error("[analisar] erro", e);
    return NextResponse.json({ erro: "Falha na análise" }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({
    endpoint: "atendimento/analisar",
    status: "ready",
    descricao:
      "POST { transcricao } → { ofensores[], severidade, notas[], riscoGrave, engine }",
  });
}
