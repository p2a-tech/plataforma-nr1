import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { sqlAdmin, dbHabilitado } from "@/lib/db";

/**
 * Captura PÚBLICA de pedidos DSAR (LGPD arts. 18-22) — direito do titular
 * de dados a solicitar acesso/exclusão/correção/portabilidade.
 *
 * Por que sqlAdmin?
 *   O canal é público (sem sessão). Não há `app.empresa_id` setado; o pedido
 *   nasce sem empresa_id (operador classifica depois). Usamos sqlAdmin para
 *   contornar RLS — a tabela `dsar_pedidos` admite linhas com empresa_id null
 *   (ver policy 0009).
 *
 * Privacidade:
 *   - IP nunca é gravado em claro — só sha256 com sal (mesmo padrão de
 *     `lib/lp-leads.ts`).
 *   - Telefone também é hasheado (não armazenamos o número cru).
 *   - Email do titular fica em claro porque é o canal de resposta.
 *   - Log de servidor jamais imprime o email completo (só o domínio).
 *
 * Honeypot anti-spam:
 *   Campo invisível `hp` no form. Bots tendem a preencher tudo. Quando vem
 *   diferente de string vazia, devolvemos 200 mas NÃO gravamos (não dar pista
 *   de que detectamos o spam).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = [
  "acesso",
  "exclusao",
  "correcao",
  "portabilidade",
  "revogacao_consentimento",
  "oposicao",
] as const;

const Schema = z
  .object({
    email_titular: z.string().trim().toLowerCase().email().max(200),
    telefone: z.string().trim().min(8).max(40).optional().or(z.literal("")),
    tipo: z.enum(TIPOS),
    justificativa: z.string().trim().max(2000).optional().or(z.literal("")),
    hp: z.string().max(120).optional(), // honeypot
  })
  .strict();

function hashCom(sal: string, valor: string): string {
  return createHash("sha256").update(`${sal}:${valor}`).digest("hex").slice(0, 32);
}

function pickIp(req: NextRequest): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

function dominioDoEmail(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1) : "(sem-dominio)";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "json_invalido" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "validacao", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;

  // Honeypot: silenciosamente ok, sem gravar.
  if (d.hp && d.hp !== "") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!dbHabilitado) {
    return NextResponse.json({ erro: "db_indisponivel" }, { status: 503 });
  }

  const sal = process.env.LP_IP_SALT ?? "previa-lp-salt-dev";
  const ip = pickIp(req);
  const ip_hash = ip ? hashCom(sal, ip) : null;
  const tel_hash = d.telefone ? hashCom(sal, d.telefone) : null;
  const user_agent = req.headers.get("user-agent") ?? null;

  try {
    const [row] = await sqlAdmin<{ id: string }[]>`
      insert into public.dsar_pedidos (
        empresa_id, email_titular, telefone_titular_hash, tipo,
        justificativa, ip_hash, user_agent
      ) values (
        null, ${d.email_titular}, ${tel_hash}, ${d.tipo},
        ${d.justificativa || null}, ${ip_hash}, ${user_agent}
      )
      returning id
    `;
    // LGPD-safe log: nunca o email completo, só o domínio (suficiente p/ debug).
    console.log("[dsar] novo pedido", {
      tipo: d.tipo,
      email_dominio: dominioDoEmail(d.email_titular),
      id: row.id,
    });
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  } catch (err) {
    console.error("[/api/dsar] erro:", err);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
