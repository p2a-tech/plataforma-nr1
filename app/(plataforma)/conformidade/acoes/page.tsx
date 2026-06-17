import Link from "next/link";
import {
  ClipboardCheck,
  ListChecks,
  CircleCheck,
  CalendarClock,
  AlertTriangle,
  Loader,
  Clock,
  Ban,
  ArrowRight,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge, ProgressBar } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { exigirSessao } from "@/lib/auth";
import {
  listarPlanos,
  resumoPlanos,
  verificarVencimentos,
  type StatusPlano,
  type PlanoAcaoEnriquecido,
} from "@/lib/plano-acao";
import { CartaoPlano, type PlanoCardData } from "./_components/cartao-plano";
import { FiltroStatus } from "./_components/filtro-status";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  Config visual das colunas de status                                        */
/* -------------------------------------------------------------------------- */
const COLUNAS: {
  status: StatusPlano;
  label: string;
  icon: React.ElementType;
  cor: string;
}[] = [
  { status: "pendente", label: "Pendente", icon: Clock, cor: "text-humano-soft" },
  { status: "em_andamento", label: "Em andamento", icon: Loader, cor: "text-ia" },
  { status: "concluido", label: "Concluído", icon: CircleCheck, cor: "text-ok" },
  { status: "cancelado", label: "Cancelado", icon: Ban, cor: "text-ink-muted" },
];

const STATUS_VALIDOS: StatusPlano[] = [
  "pendente",
  "em_andamento",
  "concluido",
  "cancelado",
];

function paraCardData(p: PlanoAcaoEnriquecido): PlanoCardData {
  return {
    id: p.id,
    titulo: p.titulo_efetivo,
    fatorNome: p.fator_nome,
    responsavel: p.responsavel,
    prazo: p.prazo,
    status: p.status,
    programa: p.programa,
  };
}

export default async function AcoesPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const sessao = exigirSessao(["sst", "admin"]);

  // Filtro por status (via query string). 'todos' ou inválido → sem filtro.
  const statusParam = searchParams?.status;
  const filtroStatus: StatusPlano | "todos" =
    statusParam && STATUS_VALIDOS.includes(statusParam as StatusPlano)
      ? (statusParam as StatusPlano)
      : "todos";

  // 1) Idempotente: cria avisos para planos vencidos ainda não notificados.
  await verificarVencimentos(sessao.empresa_id);

  // 2) Resumo (sempre sobre o universo completo, ignorando o filtro de
  //    visualização) + lista (filtrada para a visualização).
  const [resumo, planos] = await Promise.all([
    resumoPlanos(sessao.empresa_id),
    listarPlanos(sessao.empresa_id, {
      status: filtroStatus === "todos" ? undefined : [filtroStatus],
    }),
  ]);

  const semPlanos = resumo.total === 0;

  // Agrupa por status para o quadro (sobre a lista já filtrada).
  const porStatus = new Map<StatusPlano, PlanoCardData[]>();
  for (const c of COLUNAS) porStatus.set(c.status, []);
  for (const p of planos) {
    porStatus.get(p.status)?.push(paraCardData(p));
  }

  // Colunas visíveis: se há filtro, mostra só a coluna do filtro.
  const colunasVisiveis =
    filtroStatus === "todos"
      ? COLUNAS
      : COLUNAS.filter((c) => c.status === filtroStatus);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Plano de ação · acompanhamento"
        descricao="Transforme o risco diagnosticado em ação rastreada: status, responsável e prazo de cada plano NR-1. Planos vencidos geram aviso automático em Notificações."
        badge={<Badge tone="ia"><ClipboardCheck className="h-3 w-3" /> NR-1</Badge>}
        acao={
          <Link
            href="/riscos"
            className="flex shrink-0 items-center gap-2 rounded-xl border border-ia/30 bg-ia/10 px-4 py-2.5 text-sm font-medium text-ia transition hover:bg-ia/20"
          >
            <ListChecks className="h-4 w-4" /> Criar planos em /riscos
          </Link>
        }
      />

      {semPlanos ? (
        <EmptyState
          icon={<ClipboardCheck className="h-7 w-7" />}
          titulo="Nenhum plano de ação ainda"
          descricao="Os planos nascem do inventário de riscos: abra um fator NR-1 classificado e crie o plano (prevencionista ou interventivo). Eles aparecem aqui para acompanhamento de status e prazo."
          acao={
            <Link
              href="/riscos"
              className="flex items-center gap-2 rounded-xl bg-ia/15 px-4 py-2.5 text-sm font-medium text-ia ring-1 ring-inset ring-ia/30 transition hover:bg-ia/25"
            >
              <ArrowRight className="h-4 w-4" /> Ir para o inventário de riscos
            </Link>
          }
        />
      ) : (
        <>
          {/* ─── Cards de resumo ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {/* Total */}
            <Card className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill/5 text-ink-muted">
                <ListChecks className="h-5 w-5" />
              </div>
              <div>
                <div className="stat-num leading-none">{resumo.total}</div>
                <div className="mt-1 text-xs text-ink-muted">Planos no total</div>
              </div>
            </Card>

            {/* % concluído com ProgressBar */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">Concluídos</span>
                <span className="text-sm font-semibold text-ok">
                  {resumo.perc_concluido}%
                </span>
              </div>
              <div className="mt-2.5">
                <ProgressBar value={resumo.perc_concluido} tone="ok" />
              </div>
              <div className="mt-1.5 text-[11px] text-ink-muted">
                {resumo.por_status.concluido} de {resumo.total} planos
              </div>
            </Card>

            {/* Vencidos (alerta) */}
            <Card className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-alerta/10 text-alerta">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="stat-num leading-none text-alerta">{resumo.vencidos}</div>
                <div className="mt-1 text-xs text-ink-muted">Vencidos</div>
              </div>
            </Card>

            {/* A vencer 7d (âmbar) */}
            <Card className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-humano-soft/10 text-humano-soft">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <div className="stat-num leading-none text-humano-soft">
                  {resumo.a_vencer_7d}
                </div>
                <div className="mt-1 text-xs text-ink-muted">A vencer em 7 dias</div>
              </div>
            </Card>
          </div>

          {/* ─── Filtro por status ─────────────────────────────────────── */}
          <FiltroStatus atual={filtroStatus} />

          {/* ─── Quadro por status ─────────────────────────────────────── */}
          <div
            className={
              filtroStatus === "todos"
                ? "grid gap-4 lg:grid-cols-2 xl:grid-cols-4"
                : "grid gap-4"
            }
          >
            {colunasVisiveis.map((col) => {
              const itens = porStatus.get(col.status) ?? [];
              const Icon = col.icon;
              return (
                <Card key={col.status} className="flex flex-col">
                  <CardTitle
                    icon={<Icon className={`h-5 w-5 ${col.cor}`} />}
                    action={<Badge tone="neutro">{itens.length}</Badge>}
                  >
                    {col.label}
                  </CardTitle>
                  {itens.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line/15 px-3 py-6 text-center text-xs text-ink-muted">
                      Nenhum plano {col.label.toLowerCase()}.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {itens.map((p) => (
                        <CartaoPlano key={p.id} plano={p} />
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
