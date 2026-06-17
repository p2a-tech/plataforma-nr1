import { History, Download, FileText, GitCompareArrows, TrendingUp } from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { exigirSessao } from "@/lib/auth";
import { serieDimensoes } from "@/lib/drps-historico";
import { EvolucaoDimensoes } from "@/components/historico/evolucao-dimensoes";
import { ComparadorCiclos } from "@/components/historico/comparador-ciclos";
import { AlertasRegressao } from "@/components/historico/alertas-regressao";

export const dynamic = "force-dynamic";

/**
 * Histórico DRPS · Onda 5 (Dev B · §8 BACKLOG_OKEBAMBO).
 *
 * Acompanhar evolução das 5 dimensões NR-1 ao longo dos ciclos da empresa.
 * Cada ciclo é definido por `drps_campanha.ciclo` (string livre — convenção
 * "aaaa-NN" / "qN-aaaa" / "aaaa-mmm" para ordenação lexicográfica correta).
 *
 * Layout:
 *   1. Evolução das dimensões (gráfico SVG inline, 5 linhas + toggle).
 *   2. Comparador de ciclos A↔B (deltas + badge "regressão").
 *   3. Alertas de regressão automáticos (2 ciclos mais recentes).
 *   4. Botão "Baixar histórico (CSV)".
 */
export default async function HistoricoPage() {
  const sessao = exigirSessao(["sst", "admin"]);
  const empresaId = sessao.empresa_id;

  const serie = await serieDimensoes(empresaId);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Histórico DRPS"
        descricao="Evolução das 5 dimensões NR-1 ao longo dos ciclos. Detecta regressões entre ciclos consecutivos (delta > 0,5 pontos)."
        badge={
          <Badge tone={serie.length >= 2 ? "ia" : "neutro"}>
            <History className="h-3 w-3" /> {serie.length} ciclo
            {serie.length === 1 ? "" : "s"}
          </Badge>
        }
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/drps/relatorio/pdf"
              download
              className="inline-flex items-center gap-1.5 rounded-md bg-ia/15 px-3 py-1.5 text-xs font-medium text-ia ring-1 ring-inset ring-ia/25 transition hover:bg-ia/25"
            >
              <FileText className="h-3.5 w-3.5" />
              Baixar relatório executivo (PDF)
            </a>
            <a
              href="/api/drps/historico/csv"
              download
              className="inline-flex items-center gap-1.5 rounded-md bg-fill/5 px-3 py-1.5 text-xs font-medium text-ink-muted ring-1 ring-inset ring-line/20 transition hover:bg-fill/10"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar histórico (CSV)
            </a>
          </div>
        }
      />

      {/* ── Evolução das dimensões ── */}
      <Card>
        <CardTitle
          icon={<TrendingUp className="h-5 w-5" />}
          hint="Cada linha = média da dimensão em cada ciclo. Escala 1 (baixo risco) → 5 (alto risco)."
        >
          Evolução das dimensões
        </CardTitle>
        <EvolucaoDimensoes serie={serie} />
      </Card>

      {/* ── Comparador A vs B ── */}
      <Card>
        <CardTitle
          icon={<GitCompareArrows className="h-5 w-5" />}
          hint="Compare dois ciclos lado-a-lado. Δ positivo = piorou (mais risco)."
        >
          Comparador de ciclos
        </CardTitle>
        <ComparadorCiclos serie={serie} />
      </Card>

      {/* ── Alertas de regressão ── */}
      <div>
        <h2 className="mb-3 font-display text-base font-semibold tracking-tight text-ink">
          Alertas de regressão
        </h2>
        <AlertasRegressao empresaId={empresaId} />
      </div>
    </div>
  );
}
