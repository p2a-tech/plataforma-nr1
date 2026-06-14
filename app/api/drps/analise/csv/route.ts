/**
 * GET /api/drps/analise/csv
 *
 * Exporta a análise setorizada DRPS em CSV — para envio ao auditor/MPT.
 *
 * Auth: exige sessão SST ou admin. Empresa é deduzida da sessão (multi-tenancy).
 *
 * Colunas:
 *   setor; n_respostas; media_geral; media_org; media_carga; media_relacoes;
 *   media_condicoes; media_seguranca; classificacao; observacao_amostra
 *
 * K-anonimato: setores com n<7 entram com colunas de média em branco e
 * observacao_amostra="amostra_insuficiente".
 */

import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/auth";
import { dbHabilitado } from "@/lib/db";
import { analisePorSetor } from "@/lib/drps-analise";
import { rotuloClassificacao } from "@/lib/drps-escoragem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIM_ORDEM = [
  "org_trabalho",
  "carga_emocional",
  "relacoes",
  "condicoes",
  "seguranca_emoc",
];

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "banco_indisponivel" }, { status: 503 });
  }
  const sessao = exigirSessao(["sst", "admin"]);
  const empresaId = sessao.empresa_id;

  const setores = await analisePorSetor(empresaId);

  const header = [
    "setor",
    "n_respostas",
    "media_geral",
    "media_org",
    "media_carga",
    "media_relacoes",
    "media_condicoes",
    "media_seguranca",
    "classificacao",
    "observacao_amostra",
  ].join(";");

  const linhas: string[] = [header];
  for (const s of setores) {
    const dimMap = new Map(s.por_dimensao.map((d) => [d.dim_id, d.media]));
    const cells = [
      csvEscape(s.setor),
      csvEscape(s.n_respostas),
      csvEscape(s.media != null ? s.media.toFixed(2) : ""),
      ...DIM_ORDEM.map((id) => {
        const v = dimMap.get(id);
        return csvEscape(v != null ? v.toFixed(2) : "");
      }),
      csvEscape(
        s.classificacao ? rotuloClassificacao(s.classificacao) : "",
      ),
      csvEscape(s.amostra_insuficiente ? "amostra_insuficiente" : "ok"),
    ];
    linhas.push(cells.join(";"));
  }

  const csv = linhas.join("\n") + "\n";
  const periodo = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="drps-analise-${periodo}.csv"`,
      "cache-control": "no-store",
    },
  });
}
