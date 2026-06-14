import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { criarLead } from "@/lib/lp-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z
  .object({
    tipo: z.enum(["empresa", "clinica"]),
    nome: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(200),
    telefone: z.string().trim().min(8).max(40).optional().or(z.literal("")),
    empresa_nome: z.string().trim().max(160).optional().or(z.literal("")),
    cargo: z.string().trim().max(120).optional().or(z.literal("")),
    colaboradores: z.coerce.number().int().nonnegative().max(10_000_000).optional(),
    conselho: z.string().trim().max(40).optional().or(z.literal("")),
    mensagem: z.string().trim().max(1000).optional().or(z.literal("")),
    consentimento_lgpd: z.union([z.boolean(), z.literal("on"), z.literal("true")]),
    // Atribuição (silenciosamente capturada pelo front)
    utm_source: z.string().max(120).optional().or(z.literal("")),
    utm_medium: z.string().max(120).optional().or(z.literal("")),
    utm_campaign: z.string().max(160).optional().or(z.literal("")),
    utm_content: z.string().max(160).optional().or(z.literal("")),
    utm_term: z.string().max(160).optional().or(z.literal("")),
    fbclid: z.string().max(255).optional().or(z.literal("")),
    gclid: z.string().max(255).optional().or(z.literal("")),
    referer: z.string().max(500).optional().or(z.literal("")),
  })
  .strict();

function pickIp(req: NextRequest): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? undefined;
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
  const consent =
    d.consentimento_lgpd === true ||
    d.consentimento_lgpd === "on" ||
    d.consentimento_lgpd === "true";

  if (!consent) {
    return NextResponse.json(
      { erro: "consentimento_obrigatorio" },
      { status: 400 },
    );
  }

  try {
    const { id } = await criarLead({
      tipo: d.tipo,
      nome: d.nome,
      email: d.email,
      telefone: d.telefone || undefined,
      empresa_nome: d.empresa_nome || undefined,
      cargo: d.cargo || undefined,
      colaboradores: d.colaboradores,
      conselho: d.conselho || undefined,
      mensagem: d.mensagem || undefined,
      consentimento_lgpd: true,
      utm_source: d.utm_source || undefined,
      utm_medium: d.utm_medium || undefined,
      utm_campaign: d.utm_campaign || undefined,
      utm_content: d.utm_content || undefined,
      utm_term: d.utm_term || undefined,
      fbclid: d.fbclid || undefined,
      gclid: d.gclid || undefined,
      referer: d.referer || req.headers.get("referer") || undefined,
      user_agent: req.headers.get("user-agent") ?? undefined,
      ip: pickIp(req),
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("[/api/lp-lead] erro:", err);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
