/**
 * GET /api/pgr/[revisao]/pdf
 *
 * Gera o PDF assinado do PGR para uma revisão específica. Restrito a sst|admin.
 * O PDF inclui o snapshot, o inventário de riscos, o plano de ação e a
 * impressão digital (hash sha256 + selo HMAC) para auditoria/verificação.
 */

import { type NextRequest } from "next/server";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import { sql, dbHabilitado } from "@/lib/db";
import { getInventarioRiscos, type PgrAssinatura } from "@/lib/queries";
import { gerarPgrPdf } from "@/lib/pgr-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { revisao: string } },
) {
  const sessao = exigirSessao(["sst", "admin"]);
  const revisao = Number(params.revisao);
  if (!Number.isInteger(revisao) || revisao < 1) {
    return new Response("Revisão inválida", { status: 400 });
  }
  if (!dbHabilitado) return new Response("Banco indisponível", { status: 503 });

  // Tudo dentro do escopo de empresa — RLS + filtros app-level.
  const { assinatura, riscos } = await withEmpresa(sessao.empresa_id, async () => {
    const [ass] = await sql<PgrAssinatura[]>`
      select revisao, assinante_nome, assinante_papel, assinante_registro,
             assinado_em::text as assinado_em, conteudo_hash, selo
      from public.pgr_assinaturas
      where revisao = ${revisao}
      limit 1
    `;
    const { riscos } = await getInventarioRiscos();
    return { assinatura: ass, riscos };
  });

  if (!assinatura) {
    return new Response("Revisão não encontrada", { status: 404 });
  }

  // Reconstrói o resumo a partir do snapshot armazenado na assinatura.
  // (lib/queries.ts grava o `resumo` JSONB no INSERT — vamos lê-lo.)
  const [{ resumo }] = await withEmpresa(sessao.empresa_id, () =>
    sql<{ resumo: any }[]>`
      select resumo from public.pgr_assinaturas
      where revisao = ${revisao} limit 1
    `,
  );

  const pdf = await gerarPgrPdf({ assinatura, resumo, riscos });

  return new Response(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="PGR-${assinatura.revisao}-${new Date(assinatura.assinado_em).toISOString().slice(0, 10)}.pdf"`,
      "cache-control": "no-store",
      "x-pgr-hash": assinatura.conteudo_hash,
      "x-pgr-selo": assinatura.selo,
    },
  });
}
