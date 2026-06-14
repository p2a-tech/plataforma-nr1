/**
 * GET /api/drps/historico/csv — exporta o histórico DRPS da empresa em CSV.
 *
 * Onda 5 · Dev B · §8. Colunas: ciclo, dim_id, dim_nome, media, n_respostas,
 * classificacao. Gate: sst | admin.
 *
 * Decisão: CSV cru (sem BOM) e separador `;` — alinhado com
 * `/api/drps/analise/csv`, que o Excel pt-BR abre nativamente (duplo-clique,
 * sem "Dados → De Texto/CSV"). Se virar requisito, evoluímos para XLSX no
 * futuro (mantém este endpoint compatível).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSessao } from "@/lib/auth";
import { dbHabilitado } from "@/lib/db";
import { historicoParaCSV } from "@/lib/drps-historico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escape para CSV (separador `;`) — encapsula em aspas dobradas se contiver
 * `;`, aspas ou quebra de linha, dobrando aspas internas. Mesma lógica de
 * `/api/drps/analise/csv`.
 */
function csvField(v: string | number): string {
  const s = String(v);
  if (/[";\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(_req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "banco_indisponivel" }, { status: 503 });
  }
  const s = getSessao();
  if (!s) {
    return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  }
  if (s.papel !== "sst" && s.papel !== "admin") {
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });
  }

  const rows = await historicoParaCSV(s.empresa_id);

  const header = ["ciclo", "dim_id", "dim_nome", "media", "n_respostas", "classificacao"];
  const lines: string[] = [header.join(";")];
  for (const r of rows) {
    lines.push(
      [r.ciclo, r.dim_id, r.dim_nome, r.media, r.n_respostas, r.classificacao]
        .map(csvField)
        .join(";"),
    );
  }
  const csv = lines.join("\n") + "\n";

  const filename = `historico-drps-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
