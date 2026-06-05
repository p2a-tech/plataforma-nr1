import {
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Activity,
  FileCheck2,
  ArrowUpRight,
  CircleDot,
  PenLine,
  Database,
  FlaskConical,
} from "lucide-react";
import Link from "next/link";
import { Card, CardTitle, PageHeader, Badge, ProgressBar } from "@/components/ui/primitives";
import { RiscoAdesaoChart, Sparkline } from "@/components/charts";
import { Heatmap } from "@/components/heatmap";
import { corSeveridade, empresa } from "@/lib/mock-data";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import {
  getHeatmap,
  getAlertas,
  getResumo,
  getPgrStatus,
  getDashboardMetrics,
  getSerieRadarDiaria,
  type DashMetric,
} from "@/lib/queries";

// Sempre busca no servidor a cada request (dados podem ter mudado).
export const dynamic = "force-dynamic";

function tempoDesde(iso: string | null): string {
  if (!iso) return "Aguardando o primeiro atendimento";
  const d = new Date(iso);
  return `Último atendimento: ${d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;
}

export default async function DashboardPage() {
  const sessao = exigirSessao(["sst", "admin"]); // gate na página + escopo de empresa
  const [heat, alert, serie, resumo, pgr, metrics] = await withEmpresa(
    sessao.empresa_id,
    () =>
      Promise.all([
        getHeatmap(),
        getAlertas(),
        getSerieRadarDiaria(),
        getResumo(),
        getPgrStatus(),
        getDashboardMetrics(),
      ]),
  );

  const dadosReais = metrics.fonte === "real";

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Visão de Compliance & Saúde Organizacional"
        descricao={`${empresa.nome} · ${empresa.segmento}. Índice de risco psicossocial e conformidade NR-1 em tempo real.`}
        badge={
          dadosReais ? (
            <Badge tone="ok">
              <Database className="h-3 w-3" /> 100% dados reais
            </Badge>
          ) : (
            <Badge tone="ambar">
              <FlaskConical className="h-3 w-3" /> Sem dados no banco
            </Badge>
          )
        }
      />

      {!dadosReais ? (
        <EstadoVazio />
      ) : (
        <>
          {/* Cards de métrica (100% reais) */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {metrics.cards.map((m) => (
              <MetricCard key={m.id} m={m} />
            ))}
          </div>

          {/* Heatmap + Série temporal */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardTitle
                icon={<Flame className="h-5 w-5" />}
                hint="Índice de risco por setor e turno — clusters anônimos (k≥7)"
                action={<Badge tone="ok">Radar + clínica</Badge>}
              >
                Mapa de calor de risco psicossocial
              </CardTitle>
              {heat.linhas.length > 0 ? (
                <Heatmap linhas={heat.linhas} />
              ) : (
                <p className="py-8 text-center text-sm text-ink-muted">
                  Ainda sem clusters com volume suficiente (k≥7).
                </p>
              )}
            </Card>

            <Card className="lg:col-span-2">
              <CardTitle
                icon={<Activity className="h-5 w-5" />}
                hint="Últimos 14 dias · pulsos do Radar"
              >
                Evolução: risco × respostas
              </CardTitle>
              {serie.serie.length > 0 ? (
                <>
                  <RiscoAdesaoChart data={serie.serie} />
                  <div className="mt-3 flex items-center gap-5 text-xs text-ink-muted">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-humano" /> Índice de risco
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-ia" /> Respostas/dia
                    </span>
                  </div>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-ink-muted">
                  Sem respostas de pulso nos últimos 14 dias.
                </p>
              )}
            </Card>
          </div>

          {/* Alertas + Status PGR */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardTitle
                icon={<Flame className="h-5 w-5" />}
                hint="Detecção precoce por cluster — nunca dados individuais"
                action={
                  <Badge tone={alert.alertas.some((a) => a.severidade === "critico") ? "alerta" : "humano"}>
                    {alert.alertas.filter((a) => a.severidade !== "baixo").length} ativos
                  </Badge>
                }
              >
                Alertas preditivos
              </CardTitle>
              <div className="space-y-2.5">
                {alert.alertas.length === 0 && (
                  <p className="py-6 text-center text-sm text-ink-muted">
                    Nenhum cluster acima do limiar de risco. 🎉
                  </p>
                )}
                {alert.alertas.map((a) => {
                  const c = corSeveridade[a.severidade];
                  return (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 rounded-xl border border-line/5 bg-fill/[0.02] p-3 transition-colors hover:bg-fill/[0.04]"
                    >
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${c.dot} ${a.severidade === "critico" ? "animate-pulseDot" : ""}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">{a.titulo}</span>
                          <Badge
                            tone={
                              a.severidade === "critico"
                                ? "alerta"
                                : a.severidade === "alto"
                                  ? "humano"
                                  : a.severidade === "medio"
                                    ? "ambar"
                                    : "ia"
                            }
                          >
                            {c.label}
                          </Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-ink-muted">{a.cluster}</div>
                        <p className="mt-1 text-xs leading-relaxed text-ink/70">{a.descricao}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-xs font-semibold ${c.text}`}>{a.variacao}</div>
                        <div className="mt-0.5 text-[11px] text-ink-muted">{a.desde}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardTitle
                icon={<FileCheck2 className="h-5 w-5" />}
                hint="Documento vivo, atualizado automaticamente"
                action={
                  <Badge tone={pgr.pendente ? "ambar" : "ok"}>
                    rev {pgr.pendente ? pgr.proximaRevisao : pgr.revisaoVigente}
                  </Badge>
                }
              >
                Status do PGR
              </CardTitle>

              <div className="mb-4">
                <div className="mb-1.5 flex items-end justify-between">
                  <span className="text-sm text-ink-muted">Conformidade</span>
                  <span className="font-display text-2xl font-semibold text-ink">
                    {pgr.resumo.conformidade}%
                  </span>
                </div>
                <ProgressBar value={pgr.resumo.conformidade} tone="ia" />
              </div>

              <div className="space-y-2 rounded-xl border border-line/5 bg-fill/[0.02] p-3 text-xs">
                <div className="flex items-center gap-2 text-ink-muted">
                  <Activity className="h-3.5 w-3.5 text-ia" />
                  {tempoDesde(resumo.ultimaAtualizacao)}
                </div>
                {pgr.pendente ? (
                  <div className="flex items-center gap-2 text-humano-soft">
                    <PenLine className="h-3.5 w-3.5" />
                    {pgr.motivo === "conteudo_alterado"
                      ? `Conteúdo alterado — assine a revisão ${pgr.proximaRevisao}`
                      : "Pendente: assinatura do Eng. de Segurança / SESMT"}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-ok">
                    <PenLine className="h-3.5 w-3.5" />
                    Assinado por {pgr.ultima?.assinante_nome} · rev {pgr.ultima?.revisao}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Pendências de validação humana
                </div>
                {metrics.pendencias.length === 0 ? (
                  <p className="text-sm text-ok">Sem pendências. ✅</p>
                ) : (
                  <ul className="space-y-2">
                    {metrics.pendencias.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-humano" />
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Link
                href="/pgr"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ia/25 bg-ia/10 px-4 py-2.5 text-sm font-medium text-ia transition hover:bg-ia/20"
              >
                Revisar e assinar PGR
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ m }: { m: DashMetric }) {
  const TrendIcon =
    m.trendSentido === "bom" ? TrendingUp : m.trendSentido === "ruim" ? TrendingDown : Minus;
  const trendColor =
    m.trendSentido === "bom" ? "text-ok" : m.trendSentido === "ruim" ? "text-alerta" : "text-ink-muted";

  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-ink-muted">{m.rotulo}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="stat-num">{m.valor}</span>
        {m.unidade && <span className="text-lg font-medium text-ink-muted">{m.unidade}</span>}
      </div>
      <div className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
        <TrendIcon className="h-3.5 w-3.5" />
        {m.trendLabel}
      </div>
      {m.spark && m.spark.length > 1 && (
        <div className="mt-2">
          <Sparkline data={m.spark} tone={m.id === "atend" ? "ok" : "ia"} />
        </div>
      )}
    </Card>
  );
}

function EstadoVazio() {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <FlaskConical className="h-8 w-8 text-ink-muted" />
      <div>
        <div className="font-display text-lg font-semibold text-ink">Banco de dados vazio</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
          O Dashboard reflete 100% dados reais. Gere dados pelo Radar (micro-pulsos) ou pelo
          atendimento da clínica para popular as métricas.
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-muted">
        <code className="rounded-md bg-fill/5 px-2 py-1">node scripts/simular-pulsos.mjs 40</code>
        <span>ou</span>
        <Link href="/atendimento" className="text-ia hover:underline">
          registrar um atendimento
        </Link>
      </div>
    </Card>
  );
}
