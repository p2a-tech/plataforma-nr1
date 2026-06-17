import {
  BarChart3,
  AlertTriangle,
  Users,
  Activity,
  Download,
  FileText,
  Clock4,
} from "lucide-react";
import {
  Card,
  CardTitle,
  PageHeader,
  Badge,
} from "@/components/ui/primitives";
import { exigirSessao } from "@/lib/auth";
import {
  analisePorSetor,
  analisePorContrato,
  analisePorTempoEmpresa,
  outliersSetoriais,
  resumoExecutivo,
} from "@/lib/drps-analise";
import { rotuloClassificacao } from "@/lib/drps-escoragem";
import { HeatmapAnalise } from "@/components/escuta/heatmap-analise";
import { BarrasContrato } from "@/components/escuta/barras-contrato";
import { ListaOutliers } from "@/components/escuta/lista-outliers";

export const dynamic = "force-dynamic";

export default async function AnaliseDrpsPage() {
  // Auth NO TOPO da page (App Router renderiza layout em paralelo).
  const sessao = exigirSessao(["sst", "admin"]);
  const empresaId = sessao.empresa_id;

  const [resumo, setores, contratos, temposEmpresa, outliers] =
    await Promise.all([
      resumoExecutivo(empresaId),
      analisePorSetor(empresaId),
      analisePorContrato(empresaId),
      analisePorTempoEmpresa(empresaId),
      outliersSetoriais(empresaId),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Análise Setorizada DRPS"
        descricao="Heatmap setor × dimensão NR-1, risco por contrato e outliers (BACKLOG §7). Médias seguem k-anonimato ≥7 (LGPD)."
        badge={
          <Badge tone={resumo.n_total > 0 ? "ia" : "ambar"}>
            <BarChart3 className="h-3 w-3" /> {resumo.n_total} respostas
          </Badge>
        }
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/drps/relatorio/pdf"
              className="inline-flex items-center gap-2 rounded-xl border border-ia/40 bg-ia/10 px-3 py-2 text-sm font-medium text-ia transition hover:bg-ia/15"
            >
              <FileText className="h-4 w-4" /> Baixar relatório executivo (PDF)
            </a>
            <a
              href="/api/drps/analise/csv"
              className="inline-flex items-center gap-2 rounded-xl border border-line/20 bg-fill/5 px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-fill/10"
            >
              <Download className="h-4 w-4" /> Baixar análise (CSV)
            </a>
          </div>
        }
      />

      {/* ── KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Respondentes (total)"
          value={resumo.n_total}
          hint={`${resumo.n_setores} setor(es) com respostas`}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Média geral DRPS"
          value={
            resumo.media_geral != null ? resumo.media_geral.toFixed(2) : "—"
          }
          hint={
            resumo.media_geral != null
              ? `Convenção 1-5 · ${rotuloClassificacao(
                  resumo.media_geral <= 2
                    ? "baixo"
                    : resumo.media_geral <= 3.5
                    ? "moderado"
                    : "alto",
                )}`
              : "Sem amostra válida (n<7 em todos os setores)"
          }
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Dimensão mais crítica"
          value={resumo.dimensao_mais_critica?.dim_nome ?? "—"}
          hint={
            resumo.dimensao_mais_critica
              ? `média ${resumo.dimensao_mais_critica.media.toFixed(2)}`
              : "Aguardando amostras"
          }
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Contrato mais crítico"
          value={resumo.contrato_mais_critico?.forma ?? "—"}
          hint={
            resumo.contrato_mais_critico
              ? `média ${resumo.contrato_mais_critico.media.toFixed(2)} · n=${resumo.contrato_mais_critico.n}`
              : "Sem amostra suficiente"
          }
        />
      </div>

      {/* ── Heatmap setor × dimensão ── */}
      <Card>
        <CardTitle
          icon={<BarChart3 className="h-5 w-5" />}
          hint="Cada célula é a média DRPS do setor naquela dimensão NR-1."
          action={
            <Badge tone="ia">
              {setores.filter((s) => !s.amostra_insuficiente).length} setor(es)
              com amostra
            </Badge>
          }
        >
          Heatmap setor × dimensão
        </CardTitle>
        <HeatmapAnalise setores={setores} />
      </Card>

      {/* ── Por contrato ── */}
      <Card>
        <CardTitle
          icon={<Users className="h-5 w-5" />}
          hint="Risco médio por forma de contratação — corte crítico para fiscalização MPT."
        >
          Risco por forma de contratação
        </CardTitle>
        <BarrasContrato contratos={contratos} />
      </Card>

      {/* ── Outliers ── */}
      <Card>
        <CardTitle
          icon={<AlertTriangle className="h-5 w-5" />}
          hint="Setores acima da média geral por threshold de 1.0 ou 0.5·DP — investigação prioritária."
        >
          Outliers setoriais
        </CardTitle>
        <ListaOutliers outliers={outliers} />
      </Card>

      {/* ── Por tempo de empresa ── */}
      <Card>
        <CardTitle
          icon={<Clock4 className="h-5 w-5" />}
          hint="Distribuição da média DRPS por faixa de tempo de casa."
        >
          Risco por tempo de empresa
        </CardTitle>
        {temposEmpresa.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            Sem respostas para analisar por tempo de empresa.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {temposEmpresa.map((t) => (
              <div
                key={t.faixa}
                className="rounded-xl border border-line/10 bg-fill/5 p-3"
              >
                <div className="text-xs font-medium text-ink-muted">
                  {t.faixa}
                </div>
                <div className="mt-2 text-2xl font-semibold text-ink">
                  {t.amostra_insuficiente
                    ? "n<7"
                    : t.media != null
                    ? t.media.toFixed(2)
                    : "—"}
                </div>
                <div className="mt-1 text-[11px] text-ink-muted">
                  n={t.n_respostas}
                  {t.classificacao
                    ? ` · ${rotuloClassificacao(t.classificacao)}`
                    : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <span className="text-ia">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {hint && (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
          {hint}
        </p>
      )}
    </Card>
  );
}
