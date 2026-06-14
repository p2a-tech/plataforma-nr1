/**
 * PATCH /api/pgr/[revisao]/dados
 *
 * Atualiza os campos Okêbambo (§1/§3/§4.1/§4.2/§9) da revisão em rascunho.
 * Restrito a sst|admin. Validação Zod strict.
 *
 * GET → retorna os dados atuais da revisão.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import { dbHabilitado } from "@/lib/db";
import {
  atualizarDadosRevisao,
  garantirRevisaoAtual,
  obterRevisaoPorNumero,
} from "@/lib/pgr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CNPJ no formato 00.000.000/0000-00 (validação simples — Onda 4)
const CNPJ_RE = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

const RiscoManualSchema = z.object({
  risco: z.string().trim().min(1).max(200),
  fonte: z.string().trim().min(1).max(200),
  consequencia: z.string().trim().min(1).max(300),
});

const Body = z.object({
  cnpj: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || CNPJ_RE.test(v), {
      message: "CNPJ deve estar no formato 00.000.000/0000-00",
    })
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  razao_social: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  nome_fantasia: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  endereco: z
    .string()
    .trim()
    .max(400)
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  responsavel_tecnico_nome: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  responsavel_tecnico_registro: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  responsavel_tecnico_conselho: z
    .enum(["CRP", "CRM", "CREA", "COREN", "CRF", "CRO", "CRESS", "Outro", ""])
    .optional()
    .transform((v) => (v && (v as string) !== "" ? v : null)),
  publico_atendido: z
    .string()
    .trim()
    .max(400)
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  descricao_atividades: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  riscos_fisicos: z.array(RiscoManualSchema).max(50).optional(),
  riscos_ergonomicos: z.array(RiscoManualSchema).max(50).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { revisao: string } },
) {
  const sessao = exigirSessao(["sst", "admin"]);
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }
  const revisao = Number(params.revisao);
  if (!Number.isInteger(revisao) || revisao < 1) {
    return NextResponse.json({ erro: "Revisão inválida" }, { status: 400 });
  }
  const dados = await withEmpresa(sessao.empresa_id, () => obterRevisaoPorNumero(revisao));
  if (!dados) return NextResponse.json({ erro: "Revisão não encontrada" }, { status: 404 });
  return NextResponse.json({ dados });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { revisao: string } },
) {
  const sessao = exigirSessao(["sst", "admin"]);
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }
  const revisao = Number(params.revisao);
  if (!Number.isInteger(revisao) || revisao < 1) {
    return NextResponse.json({ erro: "Revisão inválida" }, { status: 400 });
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

  try {
    const atualizada = await withEmpresa(sessao.empresa_id, async () => {
      // Se a revisão pedida não for a atual em rascunho, recusamos (não editamos
      // revisões assinadas/arquivadas — assinaturas são imutáveis).
      let alvo = await obterRevisaoPorNumero(revisao);
      if (!alvo) {
        // Cria a primeira revisão se não houver nenhuma e o número pedido é "1".
        alvo = await garantirRevisaoAtual(sessao.empresa_id);
        if (alvo.revisao !== revisao) {
          throw new Error(`Revisão ${revisao} não existe.`);
        }
      }
      if (alvo.status === "assinada" || alvo.status === "arquivada") {
        throw new Error(`Revisão ${revisao} já assinada — não pode ser editada.`);
      }
      return atualizarDadosRevisao(alvo.id, parsed.data);
    });
    return NextResponse.json({ ok: true, dados: atualizada });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao atualizar";
    console.error("[pgr/dados] erro", e);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
