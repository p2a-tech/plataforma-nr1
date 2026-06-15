import "server-only";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { sqlAdmin, dbHabilitado } from "@/lib/db";

/**
 * Reset de senha (Onda 6 · Dev D) — geração/validação de tokens de uso único.
 *
 * Fluxo:
 *   1. solicitarReset(email): se o usuário existe, gera token aleatório
 *      (base64url de 32 bytes), grava sha256(token) em password_reset_tokens
 *      com TTL 1h, e devolve o token EM CLARO (para montar o link de e-mail).
 *      Se não existe, devolve null — o caller responde 200 do mesmo jeito (não
 *      vaza existência de conta).
 *   2. confirmarReset(token, novaSenha): valida força mínima, confere
 *      sha256(token) não usado e não expirado, faz UPDATE do senha_hash com
 *      bcrypt, marca o token como usado e invalida os demais tokens do usuário.
 *
 * Cross-tenant/pré-sessão → sempre via sqlAdmin.
 */

export const TTL_MS = 60 * 60 * 1000; // 1 hora
export const SENHA_MIN = 8;

/** sha256(token) em hex — o que guardamos no banco (nunca o token cru). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SolicitarResult {
  /** Token EM CLARO para montar o link. null = usuário inexistente (não vazar). */
  token: string | null;
  /** Email canônico (lowercased) do usuário, quando existe. */
  email: string | null;
}

/**
 * Gera e persiste um token de reset se o e-mail corresponder a um usuário.
 * Sempre retorna sem lançar erro de "não existe" — quem decide a resposta
 * pública é o route handler (que responde 200 sempre).
 */
export async function solicitarReset(email: string): Promise<SolicitarResult> {
  if (!dbHabilitado) return { token: null, email: null };
  const emailNorm = email.trim().toLowerCase();

  const [user] = await sqlAdmin<{ email: string }[]>`
    select email from public.usuarios
     where lower(email) = ${emailNorm}
     limit 1
  `;
  if (!user) return { token: null, email: null };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiraEm = new Date(Date.now() + TTL_MS);

  await sqlAdmin`
    insert into public.password_reset_tokens (usuario_email, token_hash, expira_em)
    values (${user.email}, ${tokenHash}, ${expiraEm})
  `;

  return { token, email: user.email };
}

export type ConfirmarResultado =
  | { ok: true; email: string }
  | { ok: false; motivo: "senha_fraca" | "token_invalido" | "db_indisponivel" };

/**
 * Confere o token e troca a senha. Token é uso único: marcamos usado_em e
 * invalidamos quaisquer outros tokens ativos do mesmo usuário.
 */
export async function confirmarReset(
  token: string,
  novaSenha: string,
): Promise<ConfirmarResultado> {
  if (!dbHabilitado) return { ok: false, motivo: "db_indisponivel" };
  if (!novaSenha || novaSenha.length < SENHA_MIN) {
    return { ok: false, motivo: "senha_fraca" };
  }

  const tokenHash = hashToken(token);

  const [row] = await sqlAdmin<{ id: string; usuario_email: string }[]>`
    select id, usuario_email
      from public.password_reset_tokens
     where token_hash = ${tokenHash}
       and usado_em is null
       and expira_em > now()
     limit 1
  `;
  if (!row) return { ok: false, motivo: "token_invalido" };

  const senhaHash = bcrypt.hashSync(novaSenha, 10);

  // Troca a senha, marca o token como usado e invalida os demais do usuário.
  await sqlAdmin.begin(async (tx) => {
    await tx`
      update public.usuarios
         set senha_hash = ${senhaHash}
       where lower(email) = lower(${row.usuario_email})
    `;
    await tx`
      update public.password_reset_tokens
         set usado_em = now()
       where id = ${row.id}
    `;
    // Uso único + invalidação dos outros tokens ativos do mesmo usuário.
    await tx`
      update public.password_reset_tokens
         set usado_em = now()
       where lower(usuario_email) = lower(${row.usuario_email})
         and usado_em is null
    `;
  });

  return { ok: true, email: row.usuario_email };
}
