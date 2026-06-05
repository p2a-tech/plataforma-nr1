/**
 * POST /api/pgr/assinar  → registra a assinatura humana (Eng./SESMT) do PGR.
 *
 * O servidor RECOMPUTA o snapshot atual (não confia em hash do cliente),
 * gera um selo HMAC tamper-evident e grava a revisão. Se o PGR já estiver
 * assinado e vigente (hash inalterado), não duplica.
 *
 * GET → estado atual do PGR (snapshot + última assinatura + pendência).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql, dbHabilitado } from "@/lib/db";
import { getPgrStatus } from "@/lib/queries";
import { selarAssinatura } from "@/lib/pgr";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import { empresa } from "@/lib/mock-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  assinante_nome: z.string().trim().min(3).max(120),
  assinante_papel: z.string().trim().min(2).max(80),
  assinante_registro: z.string().trim().max(60).optional(),
  declaro: z.literal(true), // confirmação explícita de intenção de assinar
});

export async function GET() {
  const sessao = exigirSessao(["sst", "admin"]);
  const status = await withEmpresa(sessao.empresa_id, () => getPgrStatus());
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  const sessao = exigirSessao(["sst", "admin"]);
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
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
      { erro: "Dados de assinatura inválidos", detalhe: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }
  const { assinante_nome, assinante_papel, assinante_registro } = parsed.data;

  // Recompute do snapshot no servidor — fonte de verdade. Escopo de empresa
  // vem da sessão (E5 multi-tenancy).
  const status = await withEmpresa(sessao.empresa_id, () => getPgrStatus());

  if (!status.pendente) {
    return NextResponse.json(
      { ok: true, jaAssinado: true, revisao: status.revisaoVigente, hash: status.conteudoHash },
      { status: 200 },
    );
  }

  const ts = new Date().toISOString();
  const selo = selarAssinatura({
    hash: status.conteudoHash,
    nome: assinante_nome,
    papel: assinante_papel,
    ts,
  });

  try {
    const [row] = await sql<{ id: string; revisao: number }[]>`
      insert into public.pgr_assinaturas
        (empresa_id, empresa_cnpj, revisao, conteudo_hash, resumo,
         assinante_nome, assinante_papel, assinante_registro, selo, assinado_em)
      values
        (${sessao.empresa_id}, ${empresa.cnpj}, ${status.proximaRevisao}, ${status.conteudoHash},
         ${JSON.stringify(status.resumo)}::jsonb,
         ${assinante_nome}, ${assinante_papel}, ${assinante_registro ?? null},
         ${selo}, ${ts})
      returning id, revisao
    `;
    return NextResponse.json({
      ok: true,
      assinado: true,
      revisao: row.revisao,
      hash: status.conteudoHash,
      selo,
      assinado_em: ts,
    });
  } catch (e) {
    console.error("[pgr/assinar] erro ao gravar", e);
    return NextResponse.json({ erro: "Falha ao registrar assinatura" }, { status: 500 });
  }
}
