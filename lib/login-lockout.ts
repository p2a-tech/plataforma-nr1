import "server-only";
import { createHash } from "node:crypto";
import { sqlAdmin, dbHabilitado } from "@/lib/db";

/**
 * Lockout anti-brute-force (Onda 6 · Dev D).
 *
 * Conta falhas recentes em `login_attempts` por email_hash OU ip_hash numa
 * janela de 15 min. >= LIMITE → bloqueia (o caller responde 429 + Retry-After).
 *
 * PII: nunca grava email/IP em claro — só sha256(valor + sal). O sal é
 * LP_IP_SALT (preferencial) ou AUTH_SECRET (fallback), nunca um default fixo
 * em produção (mas em dev cai num literal para não quebrar testes locais).
 *
 * Cross-tenant/pré-sessão → sempre via sqlAdmin.
 */

export const JANELA_MS = 15 * 60 * 1000; // 15 min
export const LIMITE_FALHAS = 7;

function sal(): string {
  return (
    process.env.LP_IP_SALT ||
    process.env.AUTH_SECRET ||
    "previa-lockout-salt-dev"
  );
}

export function hashLogin(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return createHash("sha256").update(`${sal()}:${valor.trim().toLowerCase()}`).digest("hex");
}

export interface StatusLockout {
  bloqueado: boolean;
  /** Falhas recentes na janela (max entre email e IP). */
  falhas: number;
  /** Segundos até liberar (aprox.), quando bloqueado. */
  retryAfterS: number;
}

/**
 * Verifica se o par (email, ip) está bloqueado por excesso de falhas recentes.
 * Fail-OPEN se o DB estiver indisponível (não impede login legítimo por causa
 * de infra — o bcrypt ainda protege).
 */
export async function verificarLockout(
  emailHash: string | null,
  ipHash: string | null,
): Promise<StatusLockout> {
  const livre: StatusLockout = { bloqueado: false, falhas: 0, retryAfterS: 0 };
  if (!dbHabilitado) return livre;
  if (!emailHash && !ipHash) return livre;

  const [row] = await sqlAdmin<{ falhas: number; ultima: Date | null }[]>`
    select count(*)::int as falhas, max(criado_em) as ultima
      from public.login_attempts
     where sucesso = false
       and criado_em > now() - interval '15 minutes'
       and (
         (${emailHash}::text is not null and email_hash = ${emailHash})
         or (${ipHash}::text is not null and ip_hash = ${ipHash})
       )
  `;

  const falhas = row?.falhas ?? 0;
  if (falhas < LIMITE_FALHAS) {
    return { bloqueado: false, falhas, retryAfterS: 0 };
  }

  // Retry-After: tempo restante da janela a partir da última falha.
  const ultima = row?.ultima ? new Date(row.ultima).getTime() : Date.now();
  const restanteMs = Math.max(0, ultima + JANELA_MS - Date.now());
  return {
    bloqueado: true,
    falhas,
    retryAfterS: Math.max(1, Math.ceil(restanteMs / 1000)),
  };
}

/** Registra uma tentativa (sucesso ou falha). Best-effort, nunca lança. */
export async function registrarTentativa(
  emailHash: string | null,
  ipHash: string | null,
  sucesso: boolean,
): Promise<void> {
  if (!dbHabilitado) return;
  try {
    await sqlAdmin`
      insert into public.login_attempts (email_hash, ip_hash, sucesso)
      values (${emailHash}, ${ipHash}, ${sucesso})
    `;
  } catch (e) {
    console.error("[lockout] falha ao registrar tentativa", e);
  }
}

/** Em login bem-sucedido, limpa as falhas recentes daquele email. */
export async function limparFalhas(emailHash: string | null): Promise<void> {
  if (!dbHabilitado || !emailHash) return;
  try {
    await sqlAdmin`
      delete from public.login_attempts
       where email_hash = ${emailHash}
         and sucesso = false
    `;
  } catch (e) {
    console.error("[lockout] falha ao limpar tentativas", e);
  }
}
