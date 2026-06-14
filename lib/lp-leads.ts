import "server-only";
import { createHash } from "node:crypto";
import { sqlAdmin, dbHabilitado } from "./db";

/**
 * Captura de leads da landing page /nr1 (tráfego pago Meta + orgânico).
 *
 * Por que `sqlAdmin`?
 *   `leads_lp` é cross-tenant (pré-venda), fica fora do RLS por empresa.
 *   Escrita acontece sem sessão (rota pública), validada por Zod antes
 *   de chegar aqui.
 *
 * LGPD: IP nunca é armazenado em claro — só sha256(IP+sal). Email/nome/tel
 * são PII com consentimento explícito (boolean obrigatório no form).
 */

export interface LeadEntrada {
  tipo: "empresa" | "clinica";
  nome: string;
  email: string;
  telefone?: string;
  empresa_nome?: string;
  cargo?: string;
  colaboradores?: number;
  conselho?: string; // CRP/CRM (clínica)
  mensagem?: string;
  consentimento_lgpd: boolean;
  // Atribuição
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  referer?: string;
  user_agent?: string;
  ip?: string; // será hasheado antes de gravar
}

function hashIp(ip?: string): string | null {
  if (!ip) return null;
  const salt = process.env.LP_IP_SALT ?? "previa-lp-salt-dev";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function criarLead(entrada: LeadEntrada): Promise<{ id: string }> {
  if (!dbHabilitado) {
    throw new Error("DB não configurado");
  }
  const ip_hash = hashIp(entrada.ip);
  const consentimento_em = entrada.consentimento_lgpd ? new Date() : null;

  const [row] = await sqlAdmin<{ id: string }[]>`
    insert into public.leads_lp (
      tipo, nome, email, telefone, empresa_nome, cargo, colaboradores,
      conselho, mensagem, consentimento_lgpd, consentimento_em,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, gclid, referer, user_agent, ip_hash
    ) values (
      ${entrada.tipo}, ${entrada.nome.trim()}, ${entrada.email.trim().toLowerCase()},
      ${entrada.telefone ?? null}, ${entrada.empresa_nome ?? null}, ${entrada.cargo ?? null},
      ${entrada.colaboradores ?? null}, ${entrada.conselho ?? null},
      ${entrada.mensagem ?? null}, ${entrada.consentimento_lgpd}, ${consentimento_em},
      ${entrada.utm_source ?? null}, ${entrada.utm_medium ?? null},
      ${entrada.utm_campaign ?? null}, ${entrada.utm_content ?? null},
      ${entrada.utm_term ?? null}, ${entrada.fbclid ?? null}, ${entrada.gclid ?? null},
      ${entrada.referer ?? null}, ${entrada.user_agent ?? null}, ${ip_hash}
    )
    returning id
  `;
  return { id: row.id };
}
