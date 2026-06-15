/**
 * POST /api/auth/reset  → solicita reset de senha.
 *
 * SEMPRE responde 200 {ok:true} — não vaza se o e-mail existe (anti-enumeração).
 * Se o usuário existir: gera token (uso único, TTL 1h) e dispara e-mail com link
 * `${APP_URL}/redefinir-senha?token=...`. Rate-limit por e-mail e por IP.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dbHabilitado } from "@/lib/db";
import { rateLimit, clientIp, rateLimitKey } from "@/lib/rate-limit";
import { solicitarReset } from "@/lib/auth-reset";
import { enviarEmail, notificar } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

function appUrl(): string {
  return (process.env.APP_URL || "https://previa.p2atech.com.br").replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
  // Resposta canônica: SEMPRE 200 (mesmo sem DB, sem usuário, ou rate-limited)
  // para não vazar informação. Diferenciamos apenas internamente.
  const okResp = NextResponse.json({ ok: true });

  if (!dbHabilitado) return okResp;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return okResp;
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return okResp;
  const { email } = parsed.data;

  // Rate-limit: 5/h por IP e 3/h por e-mail (anti-spam de reset).
  const ip = clientIp(req);
  const rlIp = rateLimit(rateLimitKey(["reset-ip", ip]), { limit: 5, windowMs: 60 * 60_000 });
  const rlEmail = rateLimit(rateLimitKey(["reset-email", email]), {
    limit: 3,
    windowMs: 60 * 60_000,
  });
  if (!rlIp.ok || !rlEmail.ok) return okResp;

  try {
    const { token } = await solicitarReset(email);
    if (token) {
      const link = `${appUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;
      const html = `
        <p>Recebemos um pedido para redefinir a senha da sua conta PrevIA.</p>
        <p><a href="${link}">Clique aqui para criar uma nova senha</a> (o link expira em 1 hora).</p>
        <p>Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>
      `;
      const texto = `Redefina sua senha PrevIA (link válido por 1h): ${link}\n\nSe não foi você, ignore este e-mail.`;
      await enviarEmail({ para: email, assunto: "Redefinição de senha · PrevIA", html, texto });
      // Trilha (sem expor o token): registra que um reset foi solicitado.
      await notificar({
        tipo: "reset_senha",
        titulo: "Reset de senha solicitado",
        corpo: `Pedido de redefinição de senha gerado para uma conta (domínio: ${email.split("@")[1] ?? "?"}).`,
      });
    }
  } catch (e) {
    console.error("[/api/auth/reset] erro:", e);
    // Continua respondendo 200 (não vaza falha interna como sinal de existência).
  }

  return okResp;
}
