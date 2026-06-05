"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  HeartHandshake,
  Filter,
  CalendarClock,
  Video,
  CheckCircle2,
  Clock3,
  Tags,
  ShieldCheck,
  Send,
  CircleDot,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  funilClinica,
  agendaClinica,
  ofensoresTags,
  indicadoresClinica,
  type Agendamento,
} from "@/lib/mock-data";

export default function ClinicaPage() {
  const [selecionadas, setSelecionadas] = useState<string[]>([
    "Sobrecarga de trabalho",
    "Conflito de liderança",
  ]);

  const toggleTag = (tag: string) =>
    setSelecionadas((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Portal da Clínica Parceira"
        descricao="Cuidado humano (Human-in-the-Loop). Pacientes encaminhados em sigilo pela IA, agenda de telemedicina e devolutiva anônima ao sistêmico."
        badge={
          <Badge tone="humano">
            <CircleDot className="h-3 w-3" /> Sigilo clínico ativo
          </Badge>
        }
      />

      {/* Indicadores B2B */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {indicadoresClinica.map((i) => (
          <KpiCard key={i.id} {...i} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Funil de pacientes encaminhados pela IA */}
        <Card className="lg:col-span-3">
          <CardTitle
            icon={<Filter className="h-5 w-5 text-humano" />}
            hint="Encaminhamentos voluntários e confidenciais ao longo do mês"
            action={<Badge tone="ia">leads qualificados pela IA</Badge>}
          >
            Funil de pacientes encaminhados
          </CardTitle>
          <Funil />
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            Os leads chegam <span className="text-ia">qualificados pela IA</span> (escuta ativa por
            cluster) e seguem, em sigilo, para o acolhimento humano da clínica.
          </p>
        </Card>

        {/* Agenda de telemedicina */}
        <Card className="lg:col-span-2">
          <CardTitle
            icon={<CalendarClock className="h-5 w-5 text-humano" />}
            hint="Quarta-feira, 28/05 · pacientes pseudonimizados"
            action={
              <Badge tone="humano">
                {agendaClinica.filter((a) => a.status !== "concluido").length} pendentes
              </Badge>
            }
          >
            Agenda de telemedicina (hoje)
          </CardTitle>
          <div className="space-y-2.5">
            {agendaClinica.map((a, i) => (
              <LinhaAgenda key={i} a={a} />
            ))}
          </div>
        </Card>
      </div>

      {/* Tags de ofensores organizacionais */}
      <Card>
        <CardTitle
          icon={<Tags className="h-5 w-5 text-humano" />}
          hint="O psicólogo tagueia apenas ofensores genéricos da organização — alimenta o lado sistêmico da IA"
          action={
            <Badge tone="humano">{selecionadas.length} selecionados</Badge>
          }
        >
          Devolutiva ao sistêmico · ofensores organizacionais
        </CardTitle>

        <div className="flex flex-wrap gap-2.5">
          {ofensoresTags.map((o) => {
            const ativo = selecionadas.includes(o.tag);
            return (
              <button
                key={o.tag}
                onClick={() => toggleTag(o.tag)}
                className={cn(
                  "group flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition",
                  ativo
                    ? "bg-humano text-onaccent ring-1 ring-inset ring-humano/60 hover:bg-humano/90"
                    : "bg-fill/[0.03] text-ink/85 ring-1 ring-inset ring-line/10 hover:bg-fill/[0.06]"
                )}
              >
                <span className="font-medium">{o.tag}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                    ativo ? "bg-onaccent/20 text-onaccent" : "bg-fill/5 text-ink-muted"
                  )}
                >
                  {o.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">
            Observação (opcional · anônima)
          </label>
          <textarea
            rows={2}
            placeholder="Padrão organizacional observado, sem qualquer dado do paciente…"
            className="w-full resize-none rounded-xl border border-line/10 bg-fill/[0.02] px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-humano/40 focus:outline-none focus:ring-1 focus:ring-humano/30"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-humano/20 bg-humano/[0.06] p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-ink/80">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-humano" />
            Apenas ofensores genéricos — nenhum dado identificável do paciente é enviado.
            <span className="text-ink-muted"> A barreira de sigilo clínico é inviolável.</span>
          </p>
          <button className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-humano px-4 py-2.5 text-sm font-semibold text-onaccent transition hover:bg-humano/90">
            <Send className="h-4 w-4" />
            Enviar para o sistêmico (anônimo)
          </button>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function KpiCard({
  rotulo,
  valor,
  trend,
  trendLabel,
}: {
  rotulo: string;
  valor: string;
  trend: "up" | "down" | "flat";
  trendLabel: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "flat" ? "text-ink-muted" : "text-humano";
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-ink-muted">{rotulo}</div>
      <div className="mt-1.5">
        <span className="stat-num">{valor}</span>
      </div>
      <div className={cn("mt-1 flex items-center gap-1 text-xs", trendColor)}>
        <TrendIcon className="h-3.5 w-3.5" />
        {trendLabel}
      </div>
    </Card>
  );
}

function Funil() {
  const topo = funilClinica[0].valor;
  return (
    <div className="space-y-2.5">
      {funilClinica.map((f, i) => {
        const largura = Math.round((f.valor / topo) * 100);
        const conv = Math.round((f.valor / topo) * 100);
        return (
          <div key={f.etapa}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink/85">{f.etapa}</span>
              <span className="text-ink-muted">
                <span className="font-display font-semibold text-ink">{f.valor}</span>
                <span className="ml-2 tabular-nums text-xs">{conv}%</span>
              </span>
            </div>
            <div className="h-9 w-full overflow-hidden rounded-lg bg-fill/[0.03]">
              <div
                className="flex h-full items-center rounded-lg bg-gradient-to-r from-humano to-humano-soft transition-all duration-700"
                style={{ width: `${largura}%` }}
              >
                <span className="pl-3 text-xs font-semibold text-onaccent">
                  {i === 0 ? "100%" : `${conv}%`}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LinhaAgenda({ a }: { a: Agendamento }) {
  const statusMap = {
    concluido: { tone: "ok" as const, label: "Concluído", Icon: CheckCircle2 },
    confirmado: { tone: "humano" as const, label: "Confirmado", Icon: Video },
    aguardando: { tone: "ambar" as const, label: "Aguardando", Icon: Clock3 },
  };
  const s = statusMap[a.status];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line/5 bg-fill/[0.02] p-3 transition-colors hover:bg-fill/[0.04]">
      <div className="w-12 shrink-0 text-center">
        <div className="font-display text-sm font-semibold text-ink">{a.hora}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{a.paciente}</div>
        <div className="truncate text-xs text-ink-muted">{a.tipo}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {a.status === "confirmado" && (
          <button className="flex items-center gap-1.5 rounded-lg bg-humano/15 px-2.5 py-1.5 text-xs font-medium text-humano ring-1 ring-inset ring-humano/25 transition hover:bg-humano/25">
            <Video className="h-3.5 w-3.5" />
            Iniciar
          </button>
        )}
        <Badge tone={s.tone}>
          <s.Icon className="h-3 w-3" /> {s.label}
        </Badge>
      </div>
    </div>
  );
}
