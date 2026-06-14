/**
 * POST /api/planos-acao
 *
 * Cria um plano de ação para um fator NR-1 (Onda 4 · §5 BACKLOG).
 * Restrito a sst|admin — só a empresa (DPO/SST) cria planos formais.
 *
 * O programa (prevencionista|interventivo) é derivado da classificação no
 * `lib/plano-acao.ts` — o cliente só envia a classificação, evitando
 * inconsistência (UI poderia enviar programa errado).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessao } from "@/lib/auth";
import { criarPlanoAcao } from "@/lib/plano-acao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["sst", "admin"]);

const Body = z
  .object({
    fator_id: z.string().trim().min(1).max(80),
    classificacao: z.enum(["baixo", "moderado", "alto"]),
    acao_id: z.string().trim().min(1).max(80).optional().nullable(),
    titulo_custom: z.string().trim().max(200).optional().nullable(),
    como_realizar_custom: z.string().trim().max(2000).optional().nullable(),
    responsavel: z.string().trim().min(1).max(160),
    /** YYYY-MM-DD (opcional). */
    prazo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use formato YYYY-MM-DD")
      .optional()
      .nullable(),
  })
  .strict()
  .refine((d) => d.acao_id || d.titulo_custom, {
    message: "Informe acao_id (catálogo) ou titulo_custom",
  });

export async function POST(req: NextRequest) {
  const sessao = getSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }
  if (!PAPEIS.has(sessao.papel)) {
    return NextResponse.json(
      { erro: "Apenas Gestor SST ou Admin podem criar planos" },
      { status: 403 },
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
      {
        erro: "Dados inválidos",
        detalhe: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 422 },
    );
  }
  const d = parsed.data;

  try {
    const plano = await criarPlanoAcao(sessao.empresa_id, {
      fator_id: d.fator_id,
      classificacao: d.classificacao,
      acao_id: d.acao_id ?? null,
      titulo_custom: d.titulo_custom ?? null,
      como_realizar_custom: d.como_realizar_custom ?? null,
      responsavel: d.responsavel,
      prazo: d.prazo ?? null,
      criado_por: sessao.email,
    });
    return NextResponse.json({ ok: true, item: plano }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao criar plano";
    console.error("[planos-acao] erro", e);
    // Mensagens de validação do domínio (acao não encontrada / programa errado)
    // viram 422 — facilita debug no front sem expor stacks.
    const isDom =
      msg.startsWith("acao_recomendada") || msg.startsWith("Informe acao_id");
    return NextResponse.json(
      { erro: msg },
      { status: isDom ? 422 : 500 },
    );
  }
}
