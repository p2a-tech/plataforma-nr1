import "server-only";
import { createHash } from "node:crypto";
import { sqlAdmin, dbHabilitado } from "@/lib/db";

/**
 * Auditoria de acesso a rotas sensíveis (LGPD art. 37 — registro de operações).
 *
 * Grava em `public.acesso_log` (sem RLS, escrita-only para previa_app via
 * sqlAdmin) cada visita autenticada a:
 *   /juridico, /governanca, /admin, /pgr, /riscos, /escuta/risco-grave
 *
 * Nunca bloqueia render: falhas são logadas no servidor e silenciadas para o
 * cliente (chamada protegida por try/catch em quem chama).
 *
 * IP é hasheado com o mesmo padrão do resto do projeto (sha256 + sal).
 */

function hashIp(ip?: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.LP_IP_SALT ?? "previa-lp-salt-dev";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export interface RegistrarAcessoParams {
  empresaId: string | null;
  usuarioEmail: string;
  papel: string;
  rota: string;
  ip?: string | null;
}

export async function registrarAcesso(p: RegistrarAcessoParams): Promise<void> {
  if (!dbHabilitado) return;
  const ip_hash = hashIp(p.ip);
  try {
    await sqlAdmin`
      insert into public.acesso_log (empresa_id, usuario_email, papel, rota, ip_hash)
      values (${p.empresaId}, ${p.usuarioEmail}, ${p.papel}, ${p.rota}, ${ip_hash})
    `;
  } catch (e) {
    // Auditoria nunca deve quebrar a aplicação.
    console.warn("[audit-access] falha ao registrar:", e);
  }
}
