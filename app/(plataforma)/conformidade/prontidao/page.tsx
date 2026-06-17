import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  CircleAlert,
  ArrowRight,
  ClipboardCheck,
} from "lucide-react";
import { Card, PageHeader, Badge, ProgressBar } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { empresa } from "@/lib/mock-data";
import { exigirSessao } from "@/lib/auth";
import {
  avaliarProntidao,
  rotuloProntidao,
  type ItemProntidao,
  type StatusProntidao,
} from "@/lib/prontidao";

export const dynamic = "force-dynamic";

export default async function ProntidaoPage() {
  const sessao = exigirSessao(["sst", "admin"]);
  const { score, itens } = await avaliarProntidao(sessao.empresa_id);

  const { rotulo, tone } = rotuloProntidao(score);
  const okCount = itens.filter((i) => i.status === "ok").length;
  const atencaoCount = itens.filter((i) => i.status === "atencao").length;
  const pendenteCount = itens.filter((i) => i.status === "pendente").length;

  // Banco zerado: tudo pendente (sem nenhum item resolvido nem em atenção).
  const tudoPendente = okCount === 0 && atencaoCount === 0 && itens.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Prontidão para auditoria NR-1"
        descricao={`${empresa.nome} · ${empresa.segmento}. Placar consolidado que responde "estamos prontos para uma fiscalização?" — agrega DRPS, risco mapeado, PGR, plano de ação, eSocial, risco grave e governança LGPD.`}
        badge={
          <Badge tone={tone}>
            <ShieldCheck className="h-3 w-3" /> {rotulo}
          </Badge>
        }
      />

      {tudoPendente ? (
        <>
          <HeroProntidao
            score={score}
            rotulo={rotulo}
            tone={tone}
            okCount={okCount}
            atencaoCount={atencaoCount}
            pendenteCount={pendenteCount}
          />
          <EmptyState
            icon={<ClipboardCheck className="h-7 w-7" />}
            titulo="Comece pela escuta para destravar o placar"
            descricao="Ainda não há evidências no banco. Aplique o DRPS, mapeie os riscos e assine o PGR — cada etapa concluída sobe o score de prontidão. O checklist abaixo aponta por onde começar."
            acao={
              <Link
                href="/escuta/drps"
                className="inline-flex items-center gap-2 rounded-xl border border-ia/30 bg-ia/10 px-4 py-2.5 text-sm font-medium text-ia transition hover:bg-ia/20"
              >
                Aplicar DRPS <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          <Checklist itens={itens} />
        </>
      ) : (
        <>
          <HeroProntidao
            score={score}
            rotulo={rotulo}
            tone={tone}
            okCount={okCount}
            atencaoCount={atencaoCount}
            pendenteCount={pendenteCount}
          />
          <Checklist itens={itens} />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — anel de score + barra + resumo                                      */
/* -------------------------------------------------------------------------- */

const TONE_STROKE: Record<"alerta" | "ambar" | "ok", string> = {
  alerta: "stroke-alerta",
  ambar: "stroke-humano-soft",
  ok: "stroke-ok",
};
const TONE_TEXT: Record<"alerta" | "ambar" | "ok", string> = {
  alerta: "text-alerta",
  ambar: "text-humano-soft",
  ok: "text-ok",
};

function HeroProntidao({
  score,
  rotulo,
  tone,
  okCount,
  atencaoCount,
  pendenteCount,
}: {
  score: number;
  rotulo: string;
  tone: "alerta" | "ambar" | "ok";
  okCount: number;
  atencaoCount: number;
  pendenteCount: number;
}) {
  // Anel SVG: raio 52, circunferência 2πr; offset proporcional ao score.
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-5 lg:items-center">
        {/* Anel */}
        <div className="flex items-center justify-center lg:col-span-2">
          <div className="relative h-36 w-36">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                strokeWidth="10"
                className="stroke-fill/10"
              />
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                className={cn("transition-all duration-700", TONE_STROKE[tone])}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("stat-num leading-none", TONE_TEXT[tone])}>{score}</span>
              <span className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-muted">
                {rotulo}
              </span>
            </div>
          </div>
        </div>

        {/* Texto + barra + contadores */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
            <ShieldCheck className="h-4 w-4 text-ia" />
            Score de prontidão para fiscalização
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink/75">
            O score pondera os requisitos de auditoria NR-1: cada item conforme vale 1 ponto,
            cada item em atenção vale meio ponto. Abaixo de 60 indica risco de autuação; de 60 a 84,
            em progresso; 85 ou mais, pronto para fiscalização.
          </p>
          <ProgressBar
            value={score}
            tone={tone === "ok" ? "ok" : tone === "ambar" ? "humano" : "ia"}
            className="mt-4 h-2.5"
          />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <ResumoBox icon={<CheckCircle2 className="h-4 w-4" />} tone="ok" valor={okCount} rotulo="Conformes" />
            <ResumoBox icon={<AlertTriangle className="h-4 w-4" />} tone="humano" valor={atencaoCount} rotulo="Em atenção" />
            <ResumoBox icon={<CircleAlert className="h-4 w-4" />} tone="alerta" valor={pendenteCount} rotulo="Pendentes" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function ResumoBox({
  icon,
  tone,
  valor,
  rotulo,
}: {
  icon: React.ReactNode;
  tone: "ok" | "humano" | "alerta";
  valor: number;
  rotulo: string;
}) {
  const text = { ok: "text-ok", humano: "text-humano", alerta: "text-alerta" }[tone];
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

/* -------------------------------------------------------------------------- */
/*  Checklist                                                                  */
/* -------------------------------------------------------------------------- */

function Checklist({ itens }: { itens: ItemProntidao[] }) {
  return (
    <Card>
      <div className="mb-4 flex items-start gap-2.5">
        <div className="mt-0.5 text-ia">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight text-ink">
            Checklist de prontidão
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Requisitos verificados a partir das evidências reais da empresa. Resolva os pendentes
            e em atenção para subir o score.
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        {itens.map((item) => (
          <ChecklistRow key={item.chave} item={item} />
        ))}
      </div>
    </Card>
  );
}

const statusStyle: Record<
  StatusProntidao,
  {
    Icon: typeof CheckCircle2;
    color: string;
    ring: string;
    bg: string;
    tone: "ok" | "ambar" | "alerta";
    label: string;
  }
> = {
  ok: {
    Icon: CheckCircle2,
    color: "text-ok",
    ring: "ring-ok/30",
    bg: "bg-ok/[0.04]",
    tone: "ok",
    label: "Conforme",
  },
  atencao: {
    Icon: AlertTriangle,
    color: "text-humano-soft",
    ring: "ring-humano-soft/25",
    bg: "bg-humano-soft/[0.05]",
    tone: "ambar",
    label: "Atenção",
  },
  pendente: {
    Icon: CircleAlert,
    color: "text-alerta",
    ring: "ring-alerta/25",
    bg: "bg-alerta/[0.05]",
    tone: "alerta",
    label: "Pendente",
  },
};

function ChecklistRow({ item }: { item: ItemProntidao }) {
  const s = statusStyle[item.status];
  const Icon = s.Icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-line/5 p-3.5 ring-1 ring-inset transition-colors hover:bg-fill/[0.04]",
        s.bg,
        s.ring,
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.color)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">{item.rotulo}</span>
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink/70">{item.detalhe}</p>
      </div>
      <Link
        href={item.href}
        className="mt-0.5 inline-flex shrink-0 items-center gap-1 self-center rounded-lg border border-line/10 bg-fill/5 px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:border-ia/30 hover:text-ia"
      >
        Resolver <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
