import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Loader2,
  ListChecks,
  GitBranch,
  Scale,
  Cpu,
  HeartHandshake,
  Download,
  Users,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge, ProgressBar } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  empresa,
  type ItemChecklist,
  type EventoESocial,
  type EventoAuditoria,
} from "@/lib/mock-data";
import { getConformidade } from "@/lib/queries";
import { contarPorSetor } from "@/lib/colaboradores";
import { pctConformidade, estaConforme } from "@/lib/conformidade-ui";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ConformidadePage() {
  const sessao = exigirSessao(["sst", "admin"]);
  const { conformidadeData, porSetorColab } = await withEmpresa(
    sessao.empresa_id,
    async () => ({
      conformidadeData: await getConformidade(),
      porSetorColab: await contarPorSetor(sessao.empresa_id),
    }),
  );
  const { fonte, checklist, eventos: eventosESocial, trilha: trilhaAuditoria } =
    conformidadeData;
  const dadosReais = fonte === "real";
  const totalColaboradores = porSetorColab.reduce((a, b) => a + b.total, 0);
  const temColaboradores = totalColaboradores > 0;

  const total = checklist.length;
  const okCount = checklist.filter((c) => c.status === "ok").length;
  const pendentes = checklist.filter((c) => c.status === "pendente").length;
  const atencoes = checklist.filter((c) => c.status === "atencao").length;
  // Guarda contra divisão por zero (banco vazio) — evita exibir "NaN%".
  const conformidade = pctConformidade(okCount, total);
  const conforme = estaConforme(total, pendentes, atencoes);
  const semConformidade = total === 0;

  const enviados = eventosESocial.filter((e) => e.status === "enviado").length;
  const processando = eventosESocial.filter((e) => e.status === "processando").length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Conformidade & eSocial"
        descricao={`${empresa.nome} · ${empresa.segmento}. Checklist NR-1, eventos do eSocial e a trilha de auditoria que comprova a ação sobre o risco.`}
        badge={
          <span className="flex items-center gap-2">
            {conforme ? (
              <Badge tone="ok">
                <ShieldCheck className="h-3 w-3" /> Conforme
              </Badge>
            ) : (
              <Badge tone="ambar">
                <AlertTriangle className="h-3 w-3" /> Atenção
              </Badge>
            )}
            {dadosReais && (
              <Badge tone="ia">
                <GitBranch className="h-3 w-3" /> Trilha real
              </Badge>
            )}
          </span>
        }
      />

      {semConformidade ? (
        <EmptyState
          icon={<ShieldCheck className="h-7 w-7" />}
          titulo="Sem dados de conformidade ainda"
          descricao="O checklist NR-1, os eventos do eSocial e a trilha de auditoria são montados a partir dos atendimentos registrados. Assim que houver evidências no banco, esta tela passa a refletir a conformidade real da empresa."
        />
      ) : (
      <>
      {/* Faixa de resumo */}
      <Card>
        <div className="grid gap-6 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
              <ShieldCheck className="h-4 w-4 text-ia" />
              Conformidade geral NR-1
            </div>
            <div className="mt-2 flex items-end gap-3">
              <span className="stat-num">{conformidade}%</span>
              <span className="mb-1.5 text-sm text-ink-muted">
                {okCount} de {total} itens em conformidade
              </span>
            </div>
            <ProgressBar
              value={conformidade}
              tone={conforme ? "ok" : "ia"}
              className="mt-3 h-2.5"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 lg:col-span-2">
            <ResumoBox icon={<CheckCircle2 className="h-4 w-4" />} tone="ok" valor={okCount} rotulo="Conformes" />
            <ResumoBox icon={<Clock className="h-4 w-4" />} tone="ambar" valor={pendentes} rotulo="Pendentes" />
            <ResumoBox icon={<AlertTriangle className="h-4 w-4" />} tone="humano" valor={atencoes} rotulo="Atenção" />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Checklist NR-1 */}
        <Card className="lg:col-span-3">
          <CardTitle
            icon={<ListChecks className="h-5 w-5" />}
            hint="Requisitos do PGR psicossocial — validados pela IA e pelo SESMT"
            action={<Badge tone="ia">{conformidade}%</Badge>}
          >
            Checklist de conformidade NR-1
          </CardTitle>
          <div className="space-y-2.5">
            {checklist.map((c) => (
              <ChecklistRow key={c.item} item={c} />
            ))}
          </div>
        </Card>

        {/* Eventos eSocial */}
        <Card className="lg:col-span-2">
          <CardTitle
            icon={<Send className="h-5 w-5" />}
            hint="Eventos de SST transmitidos ao Governo"
            action={
              <Badge tone={processando ? "ia" : "ok"}>
                {enviados}/{eventosESocial.length} enviados
              </Badge>
            }
          >
            Eventos eSocial
          </CardTitle>
          <div className="space-y-3">
            {eventosESocial.map((e) => (
              <EventoCard key={e.codigo} ev={e} />
            ))}
          </div>

          {/* Download S-2240 — XML do mês atual (NR-1 psicossocial) */}
          {(() => {
            const periodo = new Date().toISOString().slice(0, 7);
            return (
              <div className="mt-4 space-y-2.5">
                <a
                  href={`/api/esocial/s2240?periodo=${periodo}&modo=agregado`}
                  download
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ia/30 bg-ia/10 px-4 py-2.5 text-sm font-medium text-ia transition hover:bg-ia/20"
                >
                  <Download className="h-4 w-4" /> Baixar S-2240 agregado (XML)
                </a>
                <a
                  href={`/api/esocial/s2240?periodo=${periodo}&modo=por_cpf`}
                  download
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                    temColaboradores
                      ? "border-humano/30 bg-humano/10 text-humano hover:bg-humano/20"
                      : "border-line/10 bg-fill/5 text-ink-muted hover:text-ink",
                  )}
                  title={
                    temColaboradores
                      ? `Um evtExpRisco por colaborador ativo (${totalColaboradores})`
                      : "Sem colaboradores cadastrados — baixará o agregado como fallback"
                  }
                >
                  <Download className="h-4 w-4" /> Baixar S-2240 por CPF (XML)
                </a>

                {!temColaboradores && (
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-humano-soft">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    Nenhum colaborador cadastrado: o modo por CPF cai no agregado. Cadastre o quadro
                    para o fan-out real por trabalhador.
                  </p>
                )}

                <Link
                  href="/conformidade/colaboradores"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line/10 bg-fill/5 px-4 py-2 text-xs font-medium text-ink-muted transition hover:text-ink"
                >
                  <Users className="h-3.5 w-3.5" /> Gerir colaboradores
                  {temColaboradores ? ` (${totalColaboradores})` : ""}
                </Link>
              </div>
            );
          })()}
        </Card>
      </div>

      {/* Trilha de auditoria */}
      <Card>
        <CardTitle
          icon={<GitBranch className="h-5 w-5" />}
          hint="Cadeia de evidências auditável: Escuta → Cuidado → Ação → Compliance"
          action={<Badge tone="ok">Evidência viva</Badge>}
        >
          Trilha de auditoria
        </CardTitle>

        <div className="mb-5 flex items-start gap-3 rounded-xl border border-ok/20 bg-ok/[0.06] p-4">
          <Scale className="mt-0.5 h-5 w-5 shrink-0 text-ok" />
          <div>
            <p className="text-sm font-medium text-ink">Esta cadeia quebra o nexo causal.</p>
            <p className="mt-1 text-xs leading-relaxed text-ink/70">
              Ao registrar que a empresa detectou o sinal de risco e agiu sobre ele — escuta, acolhimento clínico
              em sigilo, plano de ação e atualização do PGR — cada passo vira prova documental. Isso demonstra
              diligência e reduz a responsabilidade legal em eventual litígio trabalhista.
            </p>
          </div>
        </div>

        <ol className="relative space-y-5 pl-2">
          {/* linha conectora */}
          <span
            aria-hidden
            className="absolute left-[14px] top-2 bottom-2 w-px bg-gradient-to-b from-ia/40 via-humano/40 to-ia/40"
          />
          {trilhaAuditoria.map((ev, i) => (
            <TimelineNode key={i} ev={ev} />
          ))}
        </ol>
      </Card>
      </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function ResumoBox({
  icon,
  tone,
  valor,
  rotulo,
}: {
  icon: React.ReactNode;
  tone: "ok" | "ambar" | "humano";
  valor: number;
  rotulo: string;
}) {
  const text = { ok: "text-ok", ambar: "text-humano-soft", humano: "text-humano" }[tone];
  return (
    <div className="rounded-xl border border-line/5 bg-fill/[0.02] p-3 text-center">
      <div className={cn("flex items-center justify-center gap-1.5", text)}>
        {icon}
        <span className="font-display text-xl font-semibold">{valor}</span>
      </div>
      <div className="mt-1 text-[11px] text-ink-muted">{rotulo}</div>
    </div>
  );
}

const checklistStyle = {
  ok: { icon: CheckCircle2, color: "text-ok", ring: "ring-ok/30", bg: "bg-ok/[0.04]", tone: "ok" as const, label: "Conforme" },
  pendente: { icon: Clock, color: "text-humano-soft", ring: "ring-line/5", bg: "bg-fill/[0.02]", tone: "ambar" as const, label: "Pendente" },
  atencao: { icon: AlertTriangle, color: "text-humano", ring: "ring-line/5", bg: "bg-fill/[0.02]", tone: "humano" as const, label: "Atenção" },
};

function ChecklistRow({ item }: { item: ItemChecklist }) {
  const s = checklistStyle[item.status];
  const Icon = s.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-line/5 p-3 ring-1 ring-inset transition-colors hover:bg-fill/[0.04]",
        s.bg,
        s.ring,
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.color)} />
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-ink">{item.item}</span>
        <p className="mt-0.5 text-xs leading-relaxed text-ink/70">{item.descricao}</p>
      </div>
      <Badge tone={s.tone} className="mt-0.5 shrink-0">
        {s.label}
      </Badge>
    </div>
  );
}

const esocialStyle = {
  enviado: { tone: "ok" as const, label: "Enviado", Icon: CheckCircle2, color: "text-ok", spin: false },
  processando: { tone: "ia" as const, label: "Processando", Icon: Loader2, color: "text-ia", spin: true },
  pendente: { tone: "ambar" as const, label: "Pendente", Icon: Clock, color: "text-humano-soft", spin: false },
};

function EventoCard({ ev }: { ev: EventoESocial }) {
  const s = esocialStyle[ev.status];
  const Icon = s.Icon;
  return (
    <div className="rounded-xl border border-line/5 bg-fill/[0.02] p-3.5 transition-colors hover:bg-fill/[0.04]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-base font-semibold tracking-tight text-ink">{ev.codigo}</span>
        <Badge tone={s.tone}>
          <Icon className={cn("h-3 w-3", s.color, s.spin && "animate-spin")} />
          {s.label}
        </Badge>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink/70">{ev.nome}</p>
      <div className="mt-2.5 flex items-center justify-between border-t border-line/5 pt-2.5 text-[11px] text-ink-muted">
        <span>
          <span className="font-medium text-ink/85">{ev.quantidade.toLocaleString("pt-BR")}</span> registros
        </span>
        <span>último envio: {ev.ultimo}</span>
      </div>
    </div>
  );
}

const atorStyle = {
  ia: { dot: "bg-ia", ring: "ring-ia/30", text: "text-ia", tone: "ia" as const, Icon: Cpu, label: "IA · Plataforma" },
  clinica: { dot: "bg-humano", ring: "ring-humano/30", text: "text-humano", tone: "humano" as const, Icon: HeartHandshake, label: "Clínica" },
};

function TimelineNode({ ev }: { ev: EventoAuditoria }) {
  const a = atorStyle[ev.ator];
  const Icon = a.Icon;
  return (
    <li className="relative flex gap-4">
      <span
        className={cn(
          "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-panel ring-2",
          a.ring,
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", a.dot)} />
      </span>
      <div className="min-w-0 flex-1 rounded-xl border border-line/5 bg-fill/[0.02] p-3 transition-colors hover:bg-fill/[0.04]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{ev.fase}</span>
          <Badge tone={a.tone}>
            <Icon className="h-3 w-3" />
            {a.label}
          </Badge>
          <span className="ml-auto text-[11px] text-ink-muted">{ev.data}</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-ink/75">{ev.descricao}</p>
      </div>
    </li>
  );
}
