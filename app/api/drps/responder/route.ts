/**
 * POST /api/drps/responder
 *
 * Endpoint público de captura de resposta DRPS — sem auth de usuário. O acesso
 * é controlado pelo TOKEN da campanha (determinístico HMAC sobre `empresa_id`),
 * que resolve a empresa-alvo. Ver `lib/drps.ts → tokenDeCampanha`.
 *
 * Por design:
 *   - aceita sempre o atalho `demo-token-<empresaId>` durante dev/Onda 4.
 *   - aceita o token determinístico em `tokenDeCampanha(empresaId)`.
 *   - quando o cliente envia `instrumento_id`, valida e usa esse; senão usa o
 *     template global `okebambo_v1`.
 *
 * Idempotência: `marcador_anonimo` é PK lógica por (instrumento, marcador).
 * Re-envio do MESMO marcador atualiza a resposta (apaga itens, reinsere).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dbHabilitado } from "@/lib/db";
import {
  NovaRespostaDRPS,
  resolverCampanhaPorToken,
  registrarResposta,
  carregarInstrumentoComPerguntas,
  carregarTemplateOkebambo,
} from "@/lib/drps";
import { rateLimit, clientIp, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    token: z.string().trim().min(8).max(120),
    instrumento_id: z.string().uuid().optional(),
    payload: NovaRespostaDRPS,
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }

  // Rate-limit por IP: 6 req/min — confortável pra resposta humana (≈ 1 a cada
  // 10s) mas trava bot que tenta floodar. Endpoint público sem auth, então é
  // a única barreira contra abuso depois do gate de demo-token em prod.
  const ip = clientIp(req);
  const rl = rateLimit(rateLimitKey(["drps:responder", ip]), {
    limit: 6,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { erro: "rate_limited" },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
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
      { erro: "schema_invalido", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { token, instrumento_id, payload } = parsed.data;

  // 1) Resolve campanha + empresa pelo token (Onda 5: drps_campanha.token).
  const camp = await resolverCampanhaPorToken(token);
  if (!camp) {
    return NextResponse.json(
      { erro: "token_invalido" },
      { status: 401 },
    );
  }
  const { empresa_id: empresaId, campanha_id, instrumento_id: camp_inst_id } = camp;

  // 2) Carrega instrumento — preferência: o do client > o da campanha > template global.
  const instId = instrumento_id ?? camp_inst_id ?? null;
  const instrumentoCarregado = instId
    ? await carregarInstrumentoComPerguntas(instId)
    : await carregarTemplateOkebambo();

  if (!instrumentoCarregado) {
    return NextResponse.json(
      { erro: "instrumento_nao_encontrado" },
      { status: 404 },
    );
  }
  const { instrumento } = instrumentoCarregado;

  // Se um instrumento próprio de OUTRA empresa foi passado, recusa.
  if (
    instrumento.empresa_id &&
    instrumento.empresa_id !== empresaId
  ) {
    return NextResponse.json(
      { erro: "instrumento_de_outra_empresa" },
      { status: 403 },
    );
  }

  // 3) Registra (com campanha_id resolvido pelo token).
  try {
    const resposta = await registrarResposta(
      empresaId,
      instrumento.id,
      payload,
      campanha_id,
    );
    return NextResponse.json({ id: resposta.id, ok: true }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { erro: "falha_registrar", detalhe: msg },
      { status: 500 },
    );
  }
}
