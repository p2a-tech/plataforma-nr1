import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";
import { assinarSessao, homePorPapel, COOKIE, MAX_AGE, type Papel } from "@/lib/auth";
import { rateLimit, clientIp, rateLimitKey } from "@/lib/rate-limit";

/**
 * Login genérico (qualquer papel: sst | clinica | admin).
 * Verifica bcrypt, aplica rate limit por IP+email e seta o cookie de sessão.
 */

const Body = z.object({
  email: z.string().email(),
  senha: z.string().min(1).max(200),
});

export async function loginHandler(req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }

  // Rate limit anti força-bruta: 8 tentativas / 5 min por IP.
  const ip = clientIp(req);
  const rl = rateLimit(rateLimitKey(["login", ip]), { limit: 8, windowMs: 5 * 60_000 });
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
    return NextResponse.json({ erro: "Credenciais inválidas" }, { status: 422 });
  }
  const { email, senha } = parsed.data;

  const [user] = await sql<
    {
      email: string;
      senha_hash: string;
      clinica_id: string | null;
      empresa_id: string;
      nome: string | null;
      papel: Papel;
    }[]
  >`
    select email, senha_hash, clinica_id, empresa_id, nome, papel
    from public.usuarios
    where lower(email) = lower(${email})
    limit 1
  `;

  // Sempre roda bcrypt (evita timing oracle de existência de usuário).
  const hash = user?.senha_hash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv";
  const ok = await bcrypt.compare(senha, hash);
  if (!user || !ok) {
    return NextResponse.json({ erro: "E-mail ou senha incorretos" }, { status: 401 });
  }

  const token = assinarSessao({
    papel: user.papel,
    email: user.email,
    nome: user.nome ?? undefined,
    clinica_id: user.clinica_id,
    empresa_id: user.empresa_id,
  });

  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });

  return NextResponse.json({
    ok: true,
    papel: user.papel,
    nome: user.nome,
    redirect: homePorPapel(user.papel),
  });
}

export async function logoutHandler() {
  cookies().delete(COOKIE);
  return NextResponse.json({ ok: true });
}
