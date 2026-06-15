/**
 * POST /api/atendimento/ao-vivo/token
 *
 * Minta o token LiveKit do PSICÓLOGO para uma sala de teleconsulta.
 * Gated: só papéis 'clinica' e 'admin'.
 *
 * - Se a teleconsulta não estiver configurada (LIVEKIT_* ausentes) → 503
 *   { erro: 'teleconsulta_nao_configurada' } (degradação clara).
 * - Gera uma sala anônima ('tc-' + hex) se o body não trouxer uma.
 * - O psicólogo entra como publicador (podePublicar=true) e pode administrar
 *   a sua própria sessão. O nome do paciente, se vier, NÃO é persistido — só
 *   usado como display name efêmero do token. Sem PII no banco.
 *
 * Retorna { url, token, sala } — `url` é o wss:// do SFU (o client precisa).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessao } from "@/lib/auth";
import {
  liveKitConfigurado,
  criarTokenSala,
  novaSalaAnonima,
  LIVEKIT_URL,
} from "@/lib/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["clinica", "admin"]);

const Body = z
  .object({
    sala: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_-]{3,64}$/, "Sala inválida")
      .optional(),
    nomePaciente: z.string().trim().max(120).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  // Degradação: sem credenciais, não há o que mintar.
  if (!liveKitConfigurado) {
    return NextResponse.json(
      { erro: "teleconsulta_nao_configurada" },
      { status: 503 },
    );
  }

  const sessao = getSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }
  if (!PAPEIS.has(sessao.papel)) {
    return NextResponse.json(
      { erro: "Apenas a clínica parceira pode iniciar uma teleconsulta" },
      { status: 403 },
    );
  }

  let json: unknown = {};
  try {
    // body é opcional; aceita ausência de corpo.
    const txt = await req.text();
    json = txt ? JSON.parse(txt) : {};
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

  const sala = parsed.data.sala ?? novaSalaAnonima();

  try {
    const token = await criarTokenSala({
      sala,
      // Identidade do psicólogo: opaca, sem expor email cru na sala.
      identidade: `psi-${sessao.clinica_id ?? sessao.papel}-${Date.now().toString(36)}`,
      nome: sessao.nome ?? "Psicólogo(a)",
      podePublicar: true,
    });

    return NextResponse.json({ url: LIVEKIT_URL, token, sala }, { status: 200 });
  } catch (e) {
    console.error("[ao-vivo/token] falha ao mintar token", e);
    return NextResponse.json({ erro: "Falha ao gerar token" }, { status: 500 });
  }
}
