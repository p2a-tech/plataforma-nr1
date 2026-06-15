/**
 * POST /api/auth/reset/confirmar  → conclui o reset de senha.
 *
 * Body: { token, novaSenha }. Valida força mínima (>=8), confere o token
 * (sha256, não usado, não expirado), troca a senha (bcrypt) e marca o token
 * como usado (uso único + invalida os demais tokens do usuário).
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dbHabilitado } from "@/lib/db";
import { rateLimit, clientIp, rateLimitKey } from "@/lib/rate-limit";
import { confirmarReset, SENHA_MIN } from "@/lib/auth-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  token: z.string().trim().min(10).max(200),
  novaSenha: z.string().min(SENHA_MIN, `Mínimo de ${SENHA_MIN} caracteres`).max(200),
});

export async function POST(req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }

  // Rate-limit anti força-bruta no token: 10/min por IP.
  const ip = clientIp(req);
  const rl = rateLimit(rateLimitKey(["reset-confirmar", ip]), { limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { erro: "Muitas tentativas. Tente novamente em instantes." },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
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
      { erro: "Senha muito curta (mínimo 8 caracteres) ou token inválido." },
      { status: 422 },
    );
  }

  const r = await confirmarReset(parsed.data.token, parsed.data.novaSenha);
  if (!r.ok) {
    if (r.motivo === "senha_fraca") {
      return NextResponse.json(
        { erro: "Senha muito curta (mínimo 8 caracteres)." },
        { status: 422 },
      );
    }
    if (r.motivo === "db_indisponivel") {
      return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
    }
    return NextResponse.json(
      { erro: "Link inválido ou expirado. Solicite um novo." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
