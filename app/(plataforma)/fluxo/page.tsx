import { Fragment } from "react";
import {
  RadioTower,
  HeartHandshake,
  Lock,
  FileCheck2,
  ArrowRight,
  ArrowDown,
  ShieldCheck,
  EyeOff,
  PenLine,
  Scale,
  Siren,
  Bot,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, PageHeader, Badge } from "@/components/ui/primitives";
import { RadarRings } from "@/components/brand/radar-rings";
import { fluxoPassos, type PassoFluxo } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const icones: Record<number, LucideIcon> = {
  1: RadioTower,
  2: HeartHandshake,
  3: Lock,
  4: FileCheck2,
};

export default function FluxoPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Fluxo Human-in-the-Loop"
        descricao="A IA faz a triagem e o mapeamento de risco organizacional; psicólogos parceiros fazem o cuidado humano. A IA nunca diagnostica nem faz terapia."
        badge={<Badge tone="ia"><Bot className="h-3 w-3" /> IA + Humano</Badge>}
      />

      {/* Legenda de responsabilidade */}
      <div className="flex flex-wrap items-center gap-3">
        <LaneTag tone="ia" icon={<Bot className="h-4 w-4" />} titulo="Plataforma IA" sub="Compliance organizacional · NR-1" />
        <LaneTag tone="humano" icon={<HeartHandshake className="h-4 w-4" />} titulo="Clínica parceira" sub="Cuidado do indivíduo · NR-7" />
      </div>

      {/* Os 4 passos — fluxo conectado */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {fluxoPassos.map((passo, i) => (
          <Fragment key={passo.n}>
            <div className="flex-1">
              <PassoCard passo={passo} delay={i * 0.12} />
            </div>
            {i < fluxoPassos.length - 1 && <Conector />}
          </Fragment>
        ))}
      </div>

      {/* Barreira de sigilo & anonimização — o coração da governança */}
      <Card className="relative overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <RadarRings />
        </div>
        <div className="relative grid gap-0 lg:grid-cols-[1fr_auto_1fr]">
          {/* Lado clínica */}
          <div className="p-6 lg:p-7">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-humano/15 text-humano ring-1 ring-humano/25">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-base font-semibold text-ink">Dentro da clínica</div>
                <div className="text-xs text-humano">Inviolável · sigilo profissional</div>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-ink/85">
              <ItemBarreira tone="humano">Conteúdo das sessões de terapia</ItemBarreira>
              <ItemBarreira tone="humano">Identidade e prontuário do paciente</ItemBarreira>
              <ItemBarreira tone="humano">Diagnósticos e histórico clínico</ItemBarreira>
            </ul>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-humano/10 px-3 py-2 text-xs text-humano">
              <EyeOff className="h-4 w-4 shrink-0" />
              A plataforma de IA nunca acessa este conteúdo.
            </div>
          </div>

          {/* Barreira central */}
          <div className="relative flex flex-col items-center justify-center gap-3 border-y border-dashed border-line/15 px-6 py-6 lg:border-x lg:border-y-0 lg:px-8">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.02)_0_8px,transparent_8px_16px)]" />
            <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-navy-deep ring-1 ring-line/15">
              <ShieldCheck className="h-7 w-7 text-ia" />
            </span>
            <div className="relative text-center">
              <div className="font-display text-sm font-semibold text-ink">Barreira de sigilo</div>
              <div className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                Anonimização<br />
                <span className="font-medium text-ia">k-anonymity (k ≥ 7)</span>
              </div>
            </div>
            {/* setas de fluxo cruzando a barreira */}
            <div className="relative hidden items-center gap-1 text-ink-muted lg:flex">
              <ArrowRight className="h-4 w-4 animate-pulse text-ia" />
            </div>
          </div>

          {/* Lado IA */}
          <div className="p-6 lg:p-7">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-ia/15 text-ia ring-1 ring-ia/25">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-base font-semibold text-ink">Atravessa para a IA</div>
                <div className="text-xs text-ia">Apenas dados agregados e anônimos</div>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-ink/85">
              <ItemBarreira tone="ia">Ofensores organizacionais genéricos (ex.: "sobrecarga")</ItemBarreira>
              <ItemBarreira tone="ia">Clusters por Setor / Turno (nunca pessoas)</ItemBarreira>
              <ItemBarreira tone="ia">Métricas agregadas para o PGR/GRO</ItemBarreira>
            </ul>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-ia/10 px-3 py-2 text-xs text-ia">
              <Users className="h-4 w-4 shrink-0" />
              Só existe insight quando o cluster tem k ≥ 7 pessoas.
            </div>
          </div>
        </div>
      </Card>

      {/* Princípios de governança */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Princípios de governança</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Principio
            icon={<PenLine className="h-5 w-5" />}
            tone="ia"
            titulo="Decisão humana assinada"
            texto="A IA é copiloto. O engenheiro/SESMT valida e assina o PGR — a responsabilidade legal é sempre humana."
          />
          <Principio
            icon={<Scale className="h-5 w-5" />}
            tone="ia"
            titulo="LGPD por design"
            texto="Consentimento explícito, minimização de dados e anonimato real. Privacidade não é opcional."
          />
          <Principio
            icon={<Siren className="h-5 w-5" />}
            tone="humano"
            titulo="Risco grave/iminente"
            texto="Protocolo de exceção aciona, de imediato, o cuidado humano de emergência. A vida vem antes do dado."
          />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Partes --------------------------------- */

function PassoCard({ passo, delay }: { passo: PassoFluxo; delay: number }) {
  const Icon = icones[passo.n];
  const isIA = passo.ator === "ia";
  return (
    <Card
      className="h-full animate-fade-up border-t-2 p-5"
      style={{
        animationDelay: `${delay}s`,
        borderTopColor: isIA ? "#00C2D1" : "#FF6B35",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className={cn(
            "grid h-11 w-11 place-items-center rounded-xl ring-1",
            isIA ? "bg-ia/15 text-ia ring-ia/25" : "bg-humano/15 text-humano ring-humano/25",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-display text-3xl font-semibold text-ink/15">0{passo.n}</span>
      </div>

      <Badge tone={isIA ? "ia" : "humano"} className="mb-2">
        {isIA ? <Bot className="h-3 w-3" /> : <HeartHandshake className="h-3 w-3" />}
        {isIA ? "IA" : "Clínica"}
      </Badge>

      <h3 className="font-display text-base font-semibold text-ink">{passo.titulo}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{passo.resumo}</p>

      <ul className="mt-3 space-y-1.5">
        {passo.detalhes.map((d, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-ink/80">
            <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", isIA ? "bg-ia" : "bg-humano")} />
            {d}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Conector() {
  return (
    <div className="flex shrink-0 items-center justify-center lg:w-10">
      <ArrowDown className="h-5 w-5 text-ink-muted lg:hidden" />
      <svg className="hidden h-6 w-10 lg:block" viewBox="0 0 40 24" preserveAspectRatio="none">
        <line x1="2" y1="12" x2="32" y2="12" stroke="#5B6B82" strokeWidth="2" className="flow-line" />
        <path d="M30 6 L38 12 L30 18" fill="none" stroke="#5B6B82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ItemBarreira({ children, tone }: { children: React.ReactNode; tone: "ia" | "humano" }) {
  return (
    <li className="flex items-start gap-2">
      <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone === "ia" ? "bg-ia" : "bg-humano")} />
      {children}
    </li>
  );
}

function LaneTag({
  tone,
  icon,
  titulo,
  sub,
}: {
  tone: "ia" | "humano";
  icon: React.ReactNode;
  titulo: string;
  sub: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-2.5",
        tone === "ia" ? "border-ia/25 bg-ia/5" : "border-humano/25 bg-humano/5",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg ring-1",
          tone === "ia" ? "bg-ia/15 text-ia ring-ia/25" : "bg-humano/15 text-humano ring-humano/25",
        )}
      >
        {icon}
      </span>
      <div>
        <div className="text-sm font-medium text-ink">{titulo}</div>
        <div className="text-xs text-ink-muted">{sub}</div>
      </div>
    </div>
  );
}

function Principio({
  icon,
  titulo,
  texto,
  tone,
}: {
  icon: React.ReactNode;
  titulo: string;
  texto: string;
  tone: "ia" | "humano";
}) {
  return (
    <Card className="p-5">
      <span
        className={cn(
          "mb-3 grid h-10 w-10 place-items-center rounded-xl ring-1",
          tone === "ia" ? "bg-ia/15 text-ia ring-ia/25" : "bg-humano/15 text-humano ring-humano/25",
        )}
      >
        {icon}
      </span>
      <h3 className="font-display text-base font-semibold text-ink">{titulo}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{texto}</p>
    </Card>
  );
}
