/**
 * POST /api/atendimento/ao-vivo/convidado
 *
 * Minta o token LiveKit do PACIENTE/CONVIDADO para uma sala existente.
 * SEM autenticação: é um link compartilhável (/tc/[sala]). A segurança vem do
 * nome da sala ser anônimo e imprevisível ('tc-' + 16 hex) — quem tem o link
 * entra, como numa sala de reunião por link.
 *
 * O convidado só PUBLICA e ASSINA mídia — não administra a sala (roomAdmin
 * false no token). Nenhuma PII é persistida; o `nome` é só display efêmero.
 *
 * - 503 { erro: 'teleconsulta_nao_configurada' } se LIVEKIT_* ausentes.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  liveKitConfigurado,
  criarTokenSala,
  LIVEKIT_URL,
} from "@/lib/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    sala: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_-]{3,64}$/, "Sala inválida"),
    nome: z.string().trim().max(120).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!liveKitConfigurado) {
    return NextResponse.json(
      { erro: "teleconsulta_nao_configurada" },
      { status: 503 },
    );
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
      { erro: "Payload inválido", detalhe: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }

  try {
    const token = await criarTokenSala({
      sala: parsed.data.sala,
      identidade: `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      nome: parsed.data.nome?.trim() || "Convidado(a)",
      podePublicar: true,
    });

    return NextResponse.json(
      { url: LIVEKIT_URL, token, sala: parsed.data.sala },
      { status: 200 },
    );
  } catch (e) {
    console.error("[ao-vivo/convidado] falha ao mintar token", e);
    return NextResponse.json({ erro: "Falha ao gerar token" }, { status: 500 });
  }
}
