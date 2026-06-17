import {
  ShieldCheck,
  Sparkles,
  Bot,
  PenLine,
  Grid3x3,
  ListChecks,
  Clock,
  CircleCheck,
  CalendarClock,
  AlertTriangle,
  Loader,
} from "lucide-react";
import Link from "next/link";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { EmptyStateInline } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Database, FlaskConical } from "lucide-react";
import { empresa, type Risco } from "@/lib/mock-data";
import { getInventarioRiscos } from "@/lib/queries";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import {
  MatrizRisco,
  type CelulaMatriz,
} from "@/components/riscos/matriz-risco";
import { listarFatoresComRisco, listarDimensoes } from "@/lib/riscos-nr1";
import type { Probabilidade, Impacto } from "@/lib/matriz-risco";
import { SecaoFatoresNR1 } from "./_components/secao-fatores-nr1";
import type { DimensaoBloco } from "./_components/fatores-por-dimensao";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  Helpers de nível de risco (severidade × probabilidade → 1..25)            */
/* -------------------------------------------------------------------------- */
type Nivel = { label: string; tone: "ia" | "ambar" | "humano" | "alerta" };

function nivelRisco(score: number): Nivel {
  if (score >= 15) return { label: "Crítico", tone: "alerta" };
  if (score >= 9) return { label: "Alto", tone: "humano" };
  if (score >= 4) return { label: "Médio", tone: "ambar" };
  return { label: "Baixo", tone: "ia" };
}

/** Verde (baixo) → âmbar → vermelho (crítico). score 1..25, mesma técnica do heatmap. */
function corCelula(score: number) {
  const t = (score - 1) / 24; // 0..1
  const hue = 145 - t * 145; // 145=verde, 0=vermelho
  const light = 30 + t * 14;
  return `hsl(${hue} 60% ${light}%)`;
}

/* -------------------------------------------------------------------------- */
/*  Config visual de status                                                    */
/* -------------------------------------------------------------------------- */
const statusConfig: Record<
  Risco["status"],
  { label: string; tone: "ia" | "ambar" | "ok" | "alerta"; icon: React.ElementType }
> = {
  "em-andamento": { label: "Em andamento", tone: "ia", icon: Loader },
  planejado: { label: "Planejado", tone: "ambar", icon: CalendarClock },
  concluido: { label: "Concluído", tone: "ok", icon: CircleCheck },
  atrasado: { label: "Atrasado", tone: "alerta", icon: AlertTriangle },
};

export default async function RiscosPage() {
  const sessao = exigirSessao(["sst", "admin"]);
  const eixo = [1, 2, 3, 4, 5];
  const [{ fonte, riscos }, fatoresNR1, dimensoesNR1] = await Promise.all([
    withEmpresa(sessao.empresa_id, () => getInventarioRiscos()),
    listarFatoresComRisco(sessao.empresa_id),
    listarDimensoes(),
  ]);
  const dadosReais = fonte === "real";

  // Monta dados pra <MatrizRisco /> (3×3 NR-1).
  const celulasMatriz: CelulaMatriz[] = montarCelulasMatriz(fatoresNR1);
  // Monta dados pra <FatoresPorDimensao />.
  const blocosDimensao: DimensaoBloco[] = montarBlocosDimensao(
    dimensoesNR1,
    fatoresNR1,
  );

  const resumo = [
    { id: "em-andamento" as const, rotulo: "Em andamento", icon: Loader, color: "text-ia" },
    { id: "planejado" as const, rotulo: "Planejados", icon: CalendarClock, color: "text-humano-soft" },
    { id: "atrasado" as const, rotulo: "Atrasados", icon: AlertTriangle, color: "text-alerta" },
    { id: "concluido" as const, rotulo: "Concluídos", icon: CircleCheck, color: "text-ok" },
  ];
  const contar = (s: Risco["status"]) => riscos.filter((r) => r.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Inventário de Riscos & PGR vivo"
        descricao={`${empresa.nome}. Riscos psicossociais mapeados pela fonte organizacional (NR-1) — nunca pelo indivíduo.`}
        badge={
          dadosReais ? (
            <Badge tone="ok"><Database className="h-3 w-3" /> Derivado de atendimentos reais</Badge>
          ) : (
            <Badge tone="ambar"><FlaskConical className="h-3 w-3" /> Demonstração</Badge>
          )
        }
      />

      {/* 1 — Selo de confiança IA + validação humana pendente */}
      <div className="panel flex flex-col gap-3 border-ia/15 bg-gradient-to-r from-ia/[0.07] via-transparent to-humano/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ia/10 ring-1 ring-inset ring-ia/25">
            <ShieldCheck className="h-5 w-5 text-ia" />
            <Bot className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-navy-panel p-0.5 text-ia" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-ia">
                <Sparkles className="h-3.5 w-3.5" /> Atualizado automaticamente pela IA
              </span>
              <span className="tag bg-humano-soft/15 text-humano-soft ring-1 ring-inset ring-humano-soft/25">
                <PenLine className="h-3 w-3" /> validação humana pendente
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Inventário recalculado em tempo real · aguardando assinatura do Eng. de Segurança / SESMT.
            </p>
          </div>
        </div>
        <Link
          href="/pgr"
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-humano-soft/30 bg-humano-soft/10 px-4 py-2.5 text-sm font-medium text-humano-soft transition hover:bg-humano-soft/20"
        >
          <PenLine className="h-4 w-4" /> Assinar revisão
        </Link>
      </div>

      {/* 4 — Faixa de resumo por status */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {resumo.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.id} className="flex items-center gap-3 p-4">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-fill/5", r.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="stat-num leading-none">{contar(r.id)}</div>
                <div className="mt-1 text-xs text-ink-muted">{r.rotulo}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ─── NR-1 (Onda 4) · matriz 3×3 + fatores por dimensão ─────────── */}
      <MatrizRisco celulas={celulasMatriz} />

      <SecaoFatoresNR1 dimensoes={blocosDimensao} />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 2 — Matriz de risco 5×5 (inventário legado) */}
        <Card className="lg:col-span-2">
          <CardTitle
            icon={<Grid3x3 className="h-5 w-5" />}
            hint="Severidade × Probabilidade — cada risco posicionado em sua célula"
            action={<Badge tone="ia">5 × 5</Badge>}
          >
            Matriz de risco
          </CardTitle>

          <div className="overflow-x-auto">
            <div className="flex min-w-[340px] gap-2">
              {/* Rótulo vertical do eixo Y */}
              <div className="flex items-center">
                <span className="rotate-180 text-[11px] font-medium uppercase tracking-wider text-ink-muted [writing-mode:vertical-rl]">
                  Severidade
                </span>
              </div>

              <div className="flex-1">
                <div className="grid grid-cols-[20px_repeat(5,1fr)] gap-1">
                  {/* Linhas: severidade 5 → 1 */}
                  {[5, 4, 3, 2, 1].map((sev) => (
                    <Linha key={sev} sev={sev} eixo={eixo} riscos={riscos} />
                  ))}

                  {/* Eixo X (probabilidade 1 → 5) */}
                  <div />
                  {eixo.map((p) => (
                    <div key={p} className="pt-1 text-center text-[11px] font-medium text-ink-muted">
                      {p}
                    </div>
                  ))}
                </div>
                <div className="mt-1 text-center text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                  Probabilidade
                </div>
              </div>
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-ink-muted">Baixo</span>
            <div
              className="h-2 flex-1 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(145 60% 32%), hsl(72 60% 36%), hsl(30 60% 40%), hsl(0 60% 44%))",
              }}
            />
            <span className="text-xs text-ink-muted">Crítico</span>
          </div>
        </Card>

        {/* 3 — Tabela / lista de riscos */}
        <Card className="lg:col-span-3">
          <CardTitle
            icon={<ListChecks className="h-5 w-5" />}
            hint="Fonte do risco = organização do trabalho, não o indivíduo (NR-1)"
            action={
              <Link
                href="/conformidade/acoes"
                className="flex items-center gap-1.5 rounded-lg border border-ia/25 bg-ia/5 px-3 py-1.5 text-xs font-medium text-ia transition hover:bg-ia/15"
              >
                <ListChecks className="h-3.5 w-3.5" /> Acompanhar planos de ação
              </Link>
            }
          >
            Plano de ação por risco
          </CardTitle>

          {riscos.length === 0 ? (
            <EmptyStateInline
              icon={<ListChecks className="h-6 w-6" />}
              titulo="Nenhum risco mapeado ainda"
              descricao="Os riscos psicossociais são derivados dos atendimentos e dos pulsos do Radar (NR-1). Assim que houver volume suficiente por cluster, o inventário e o plano de ação aparecem aqui."
            />
          ) : (
          <>
          {/* Desktop: tabela real */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line/10 text-left text-xs uppercase tracking-wider text-ink-muted">
                  <th scope="col" className="px-2 py-2 font-medium">ID</th>
                  <th scope="col" className="px-2 py-2 font-medium">Fonte (organização do trabalho)</th>
                  <th scope="col" className="px-2 py-2 font-medium">Setor/Cluster</th>
                  <th scope="col" className="px-2 py-2 font-medium">Nível</th>
                  <th scope="col" className="px-2 py-2 font-medium">Ação</th>
                  <th scope="col" className="px-2 py-2 font-medium">Responsável</th>
                  <th scope="col" className="px-2 py-2 font-medium">Prazo</th>
                  <th scope="col" className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {riscos.map((r) => {
                  const score = r.severidade * r.probabilidade;
                  const nivel = nivelRisco(score);
                  const st = statusConfig[r.status];
                  const StatusIcon = st.icon;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-line/5 align-top transition-colors hover:bg-fill/[0.03]"
                    >
                      <td className="px-2 py-3 font-mono text-xs font-semibold text-ia">{r.id}</td>
                      <td className="px-2 py-3 font-medium text-ink">{r.fonte}</td>
                      <td className="px-2 py-3 text-ink-muted">{r.setor}</td>
                      <td className="px-2 py-3">
                        <Badge tone={nivel.tone}>{nivel.label}</Badge>
                        <div className="mt-1 text-[11px] text-ink-muted">{score} pts</div>
                      </td>
                      <td className="px-2 py-3 max-w-[220px] text-xs leading-relaxed text-ink/75">{r.acao}</td>
                      <td className="px-2 py-3 text-ink-muted">{r.responsavel}</td>
                      <td className="px-2 py-3 whitespace-nowrap text-ink-muted">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> {r.prazo}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <Badge tone={st.tone}>
                          <StatusIcon className="h-3 w-3" /> {st.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards empilhados */}
          <div className="space-y-3 md:hidden">
            {riscos.map((r) => {
              const score = r.severidade * r.probabilidade;
              const nivel = nivelRisco(score);
              const st = statusConfig[r.status];
              const StatusIcon = st.icon;
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-line/5 bg-fill/[0.02] p-3 transition-colors hover:bg-fill/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-ia">{r.id}</span>
                      <Badge tone={nivel.tone}>{nivel.label}</Badge>
                    </span>
                    <Badge tone={st.tone}>
                      <StatusIcon className="h-3 w-3" /> {st.label}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm font-medium text-ink">{r.fonte}</div>
                  <div className="text-xs text-ink-muted">{r.setor}</div>
                  <p className="mt-2 text-xs leading-relaxed text-ink/75">{r.acao}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted">
                    <span>{r.responsavel}</span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> {r.prazo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          </>
          )}
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers NR-1 (Onda 4) — agrupam fatores em células 3×3 e blocos dimensão   */
/* -------------------------------------------------------------------------- */
type FatorNR1ComRisco = Awaited<ReturnType<typeof listarFatoresComRisco>>[number];

function montarCelulasMatriz(fatores: FatorNR1ComRisco[]): CelulaMatriz[] {
  const probs: Probabilidade[] = ["alta", "media", "baixa"];
  const impactos: Impacto[] = ["baixo", "medio", "alto"];
  // K-anonimato (LGPD): só contamos fatores cuja amostra atingiu o mínimo k=7.
  // Fatores com amostra insuficiente seguem visíveis no accordion (com badge),
  // mas não influenciam a contagem da matriz 3×3.
  const elegiveis = fatores.filter((f) => f.kAnonimato);
  return probs.flatMap((prob) =>
    impactos.map((imp) => ({
      prob,
      impacto: imp,
      fatores: elegiveis
        .filter((f) => f.probabilidade === prob && f.impacto === imp)
        .map((f) => ({ id: f.id, nome: f.nome })),
    })),
  );
}

function montarBlocosDimensao(
  dimensoes: Awaited<ReturnType<typeof listarDimensoes>>,
  fatores: FatorNR1ComRisco[],
): DimensaoBloco[] {
  return dimensoes.map((d) => ({
    id: d.id,
    nome: d.nome,
    fatores: fatores
      .filter((f) => f.dim_id === d.id)
      .map((f) => ({
        id: f.id,
        nome: f.nome,
        probabilidade: f.probabilidade,
        impacto: f.impacto,
        classificacao: f.classificacao,
        frequencia: f.frequencia,
        n_citacoes: f.n_citacoes,
        n_respostas: f.n_respostas,
        kAnonimato: f.kAnonimato,
      })),
  }));
}

/* -------------------------------------------------------------------------- */
/*  Linha da matriz: uma faixa de severidade fixa, 5 colunas de probabilidade */
/* -------------------------------------------------------------------------- */
function Linha({ sev, eixo, riscos }: { sev: number; eixo: number[]; riscos: Risco[] }) {
  const MAX_CHIPS = 3;
  return (
    <>
      <div className="flex items-center justify-center text-[11px] font-medium text-ink-muted">{sev}</div>
      {eixo.map((prob) => {
        const score = sev * prob;
        const celulaRiscos = riscos.filter(
          (r) => r.severidade === sev && r.probabilidade === prob,
        );
        const nivel = nivelRisco(score);
        const visiveis = celulaRiscos.slice(0, MAX_CHIPS);
        const extra = celulaRiscos.length - visiveis.length;
        return (
          <div
            key={prob}
            className="group relative flex min-h-[3.5rem] flex-wrap content-center items-center justify-center gap-1 overflow-hidden rounded-lg p-1.5 transition-transform hover:z-10 hover:scale-[1.05]"
            style={{ backgroundColor: corCelula(score) }}
            title={
              celulaRiscos.length > 0
                ? `Sev ${sev} × Prob ${prob} (${nivel.label}) — ${celulaRiscos.map((r) => r.id).join(", ")}`
                : `Severidade ${sev} × Probabilidade ${prob} — ${nivel.label} (${score})`
            }
          >
            {celulaRiscos.length === 0 ? (
              <span className="text-[10px] font-medium text-white/40">{score}</span>
            ) : (
              <>
                {visiveis.map((r) => (
                  <span
                    key={r.id}
                    className="rounded-md bg-onaccent/85 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-white ring-1 ring-inset ring-[rgba(255,255,255,0.25)]"
                  >
                    {r.id}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="rounded-md bg-onaccent/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-white ring-1 ring-inset ring-[rgba(255,255,255,0.25)]">
                    +{extra}
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
