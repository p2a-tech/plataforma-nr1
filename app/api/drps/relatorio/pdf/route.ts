/**
 * GET /api/drps/relatorio/pdf
 *
 * Relatório executivo do DRPS em PDF (Onda 8 · Dev C). Restrito a sst|admin.
 * A empresa é deduzida da sessão (multi-tenancy). O documento é anônimo por
 * construção (k-anonimato ≥ 7, sem PII) — pronto para auditoria/MPT.
 */

import { type NextRequest } from "next/server";
import { exigirSessao } from "@/lib/auth";
import { dbHabilitado } from "@/lib/db";
import { gerarRelatorioDrps } from "@/lib/drps-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const sessao = exigirSessao(["sst", "admin"]);
  if (!dbHabilitado) return new Response("Banco indisponível", { status: 503 });

  const pdf = await gerarRelatorioDrps(sessao.empresa_id);

  const data = new Date().toISOString().slice(0, 10);
  const slug = sessao.empresa_id.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40);

  return new Response(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="relatorio-drps-${slug}-${data}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
