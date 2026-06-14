import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  Gauge,
  Headphones,
  HeartPulse,
  Landmark,
  LineChart,
  Lock,
  Radio,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import { LeadForm } from "./_components/lead-form";

/**
 * Landing page pública /nr1 — destino do tráfego pago Meta + orgânico.
 * Dois funis de conversão: empresa (CTA ciano) e psicólogo parceiro (laranja).
 * Foco: NR-1 entrou em vigor, multas, eSocial S-2240, Human-in-the-Loop.
 */

export default function NR1Landing() {
  return (
    <main className="overflow-x-hidden">
      <TopBar />
      <Hero />
      <StatsBar />
      <Urgencia />
      <ComoFunciona />
      <Diferencial />
      <ProvaSocial />
      <ParaClinicas />
      <FAQ />
      <CTAFinal />
      <Footer />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top bar minimalista (logo + link para a plataforma)                       */
/* -------------------------------------------------------------------------- */
function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/10 bg-navy/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 md:px-8">
        <Link href="/nr1" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-ia text-onaccent shadow-glow">
            <Brain className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-semibold tracking-tight text-ink">
              PrevIA
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              por P2A Tech
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <a
            href="#formulario"
            className="hidden rounded-lg border border-line/15 px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:border-ia/40 hover:text-ink md:inline-flex"
          >
            Falar com a gente
          </a>
          <Link
            href="/login"
            className="rounded-lg bg-ia/10 px-3.5 py-1.5 text-xs font-medium text-ia ring-1 ring-inset ring-ia/30 hover:bg-ia/15"
          >
            Acessar plataforma →
          </Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — pre-headline urgência + headline forte + 2 CTAs + visual painel    */
/* -------------------------------------------------------------------------- */
function Hero() {
  return (
    <section className="relative isolate">
      {/* Glow de fundo */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[560px] w-[1100px] -translate-x-1/2 rounded-full bg-ia/10 blur-[120px]" />
        <div className="absolute right-0 top-40 h-[420px] w-[680px] rounded-full bg-humano/10 blur-[120px]" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 md:grid-cols-12 md:gap-10 md:px-8 md:py-24">
        <div className="md:col-span-7">
          {/* Pre-headline urgência */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-alerta/30 bg-alerta/10 px-3 py-1.5 text-xs font-medium text-alerta animate-fade-up">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alerta opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-alerta" />
            </span>
            NR-1 ATUALIZADA · em vigor desde maio de 2025
          </div>

          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink md:text-6xl animate-fade-up">
            Sua empresa cumpre a{" "}
            <span className="relative whitespace-nowrap">
              <span className="bg-gradient-to-r from-ia to-humano bg-clip-text text-transparent">
                nova NR-1?
              </span>
              <span className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-ia to-humano opacity-50" />
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted animate-fade-up md:text-xl">
            A primeira plataforma brasileira que une <strong className="text-ia">IA</strong>{" "}
            e{" "}
            <strong className="text-humano">cuidado humano</strong> para entregar
            conformidade com a NR-1 e gestão real de riscos psicossociais.{" "}
            <strong className="text-ink">Sem planilha. Sem consultor. Sem multa.</strong>
          </p>

          {/* Trust dot */}
          <p className="mt-5 inline-flex items-center gap-2 text-sm text-ink-muted animate-fade-up">
            <CheckCircle2 className="h-4 w-4 text-ok" />
            Implantação completa em{" "}
            <strong className="text-ink">até 14 dias</strong> — sem trocar de consultoria.
          </p>

          {/* CTAs */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row animate-fade-up">
            <a
              href="#formulario"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-ia px-6 py-3.5 text-sm font-semibold text-onaccent shadow-glow transition hover:brightness-110"
            >
              Sou empresa · ver demo em 20min
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
            <a
              href="#parceiros"
              className="group inline-flex items-center justify-center gap-2 rounded-xl border border-humano/40 bg-humano/10 px-6 py-3.5 text-sm font-semibold text-humano transition hover:bg-humano/15"
            >
              Sou psicólogo · ser parceiro
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
          </div>

          {/* Mini-features */}
          <ul className="mt-8 grid grid-cols-2 gap-y-2.5 text-xs text-ink-muted md:max-w-md">
            {[
              { icon: <ShieldCheck className="h-3.5 w-3.5 text-ok" />, t: "LGPD por design" },
              { icon: <Zap className="h-3.5 w-3.5 text-ia" />, t: "Implantação em 2 semanas" },
              { icon: <BadgeCheck className="h-3.5 w-3.5 text-ok" />, t: "eSocial S-2240 nativo" },
              { icon: <HeartPulse className="h-3.5 w-3.5 text-humano" />, t: "Clínicas parceiras NR-7" },
            ].map((f) => (
              <li key={f.t} className="flex items-center gap-1.5">
                {f.icon} {f.t}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual: "Dashboard ao vivo" */}
        <div className="relative md:col-span-5">
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}

function HeroDashboard() {
  return (
    <div className="relative">
      {/* badge AO VIVO flutuante */}
      <div className="absolute -top-3 right-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-ia/30 bg-navy px-2.5 py-1 text-[11px] font-medium text-ia shadow-glow">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ia opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ia" />
        </span>
        AO VIVO · escuta ativa
      </div>

      <div className="panel relative overflow-hidden p-5 shadow-glow">
        {/* Header do mini-dashboard */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-ia/15 text-ia">
              <LineChart className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-muted">
                Risco psicossocial
              </div>
              <div className="font-display text-sm font-semibold text-ink">
                Painel SST · últimos 30 dias
              </div>
            </div>
          </div>
          <span className="tag bg-ok/15 text-ok ring-1 ring-inset ring-ok/25">
            NR-1 OK
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <KPI label="Adesão" valor="82%" tone="ia" />
          <KPI label="Pulsos" valor="2.341" tone="ok" />
          <KPI label="PGR" valor="✓" tone="humano" />
        </div>

        {/* Mini gráfico fake (linha animada) */}
        <div className="mt-4 rounded-xl border border-line/10 bg-fill/5 p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-ink-muted">
            <span>Energia média por setor</span>
            <span className="text-ok">↑ 12%</span>
          </div>
          <svg viewBox="0 0 220 60" className="h-14 w-full">
            <defs>
              <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#00C2D1" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#00C2D1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,40 C30,30 50,38 70,28 C90,18 110,32 140,22 C160,16 180,26 220,12 L220,60 L0,60 Z"
              fill="url(#g1)"
            />
            <path
              d="M0,40 C30,30 50,38 70,28 C90,18 110,32 140,22 C160,16 180,26 220,12"
              stroke="#00C2D1"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="220" cy="12" r="3" fill="#00C2D1">
              <animate
                attributeName="r"
                values="3;5;3"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </div>

        {/* Heatmap micro */}
        <div className="mt-3 grid grid-cols-7 gap-1">
          {Array.from({ length: 21 }).map((_, i) => {
            const tone = [0, 0, 1, 0, 2, 0, 1, 0, 0, 1, 0, 0, 2, 1, 0, 0, 1, 0, 0, 0, 0][i];
            const bg =
              tone === 2
                ? "bg-alerta/70"
                : tone === 1
                  ? "bg-humano-soft/70"
                  : "bg-ia/30";
            return <div key={i} className={`h-4 rounded ${bg}`} />;
          })}
        </div>

        {/* Encaminhamento humano */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-humano/25 bg-humano/10 p-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-humano/20 text-humano">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-ink">
              Caso individual encaminhado para clínica parceira
            </div>
            <div className="text-[11px] text-ink-muted">
              Anonimizado · cadeia de evidências · NR-7
            </div>
          </div>
          <CheckCircle2 className="h-4 w-4 text-ok" />
        </div>
      </div>
    </div>
  );
}

function KPI({
  label,
  valor,
  tone,
}: {
  label: string;
  valor: string;
  tone: "ia" | "ok" | "humano";
}) {
  const color =
    tone === "ia" ? "text-ia" : tone === "ok" ? "text-ok" : "text-humano";
  return (
    <div className="rounded-lg border border-line/10 bg-fill/5 p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className={`font-display text-xl font-semibold ${color}`}>
        {valor}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stats bar — números fortes                                                */
/* -------------------------------------------------------------------------- */
function StatsBar() {
  const stats = [
    { num: "7", sub: "dimensões da NR-1 cobertas", icon: <ClipboardCheck className="h-5 w-5" /> },
    { num: "100%", sub: "conforme eSocial S-2240", icon: <BadgeCheck className="h-5 w-5" /> },
    { num: "14 dias", sub: "tempo médio de implantação", icon: <Zap className="h-5 w-5" /> },
    { num: "LGPD", sub: "por design · DPIA inclusa", icon: <ShieldCheck className="h-5 w-5" /> },
  ];
  return (
    <section className="border-y border-line/10 bg-navy-deep/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-6 px-5 py-9 md:grid-cols-4 md:px-8">
        {stats.map((s) => (
          <div key={s.sub} className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ia/10 text-ia">
              {s.icon}
            </div>
            <div>
              <div className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                {s.num}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-ink-muted">
                {s.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Urgência: por que NR-1 mudou tudo                                         */
/* -------------------------------------------------------------------------- */
function Urgencia() {
  const cards = [
    {
      icon: <AlertTriangle className="h-5 w-5" />,
      titulo: "Multa por trabalhador exposto",
      texto: "De R$ 4.685 a R$ 670 mil por dispositivo descumprido. Multiplique pelo seu efetivo.",
      tag: "Risco financeiro",
    },
    {
      icon: <ClipboardCheck className="h-5 w-5" />,
      titulo: "eSocial S-2240 obrigatório",
      texto: "Riscos psicossociais agora entram no PGR e no S-2240. Falta = inconsistência no eSocial.",
      tag: "Compliance digital",
    },
    {
      icon: <Gauge className="h-5 w-5" />,
      titulo: "MPT criou força-tarefa",
      texto: "Fiscalização de saúde mental no trabalho ganhou prioridade. Auditores treinados em NR-1 psicossocial.",
      tag: "Fiscalização ativa",
    },
    {
      icon: <Landmark className="h-5 w-5" />,
      titulo: "Sindicato e CIPA cobram",
      texto: "Atas precisam comprovar gestão de riscos psicossociais. Sem evidência = passivo trabalhista.",
      tag: "Risco trabalhista",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
      <div className="mb-12 max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-alerta/30 bg-alerta/10 px-3 py-1 text-xs font-medium text-alerta">
          <AlertTriangle className="h-3.5 w-3.5" /> Por que agora
        </div>
        <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
          A NR-1 mudou tudo. <br className="hidden md:block" />
          <span className="text-ink-muted">E o relógio está correndo.</span>
        </h2>
        <p className="mt-4 text-base text-ink-muted md:text-lg">
          A nova NR-1 (Portaria MTE 1.419/2024) entrou em vigor em <strong className="text-ink">maio de 2025</strong>{" "}
          e, pela primeira vez na história do Brasil, exige que riscos psicossociais sejam
          tratados no PGR como qualquer outro risco ocupacional.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.titulo} className="panel group p-5 transition hover:border-alerta/30">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-alerta/15 text-alerta transition group-hover:scale-110">
              {c.icon}
            </div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-alerta/80">
              {c.tag}
            </div>
            <h3 className="mb-2 font-display text-lg font-semibold tracking-tight text-ink">
              {c.titulo}
            </h3>
            <p className="text-sm leading-relaxed text-ink-muted">{c.texto}</p>
          </div>
        ))}
      </div>

      {/* Quote sumária */}
      <div className="mt-10 rounded-2xl border border-line/10 bg-fill/5 p-6 md:p-8">
        <p className="font-display text-xl leading-relaxed text-ink md:text-2xl">
          &ldquo;Empresas vão precisar comprovar gestão de riscos psicossociais com{" "}
          <strong className="text-ia">o mesmo rigor</strong> que comprovam EPI e
          PCMSO. Quem não tiver, vai descobrir do pior jeito.&rdquo;
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          — Especialista em SST, sobre a Portaria MTE 1.419/2024
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Como funciona — 3 passos Human-in-the-Loop                                 */
/* -------------------------------------------------------------------------- */
function ComoFunciona() {
  const passos = [
    {
      n: "01",
      tone: "ia" as const,
      icon: <Radio className="h-5 w-5" />,
      titulo: "Escuta IA",
      sub: "WhatsApp · 7 perguntas · 90 segundos",
      bullets: [
        "Pulsos quinzenais ou mensais (você decide)",
        "K-anonimato mínimo de 7 pessoas: ninguém é identificável",
        "Adesão típica de 72 a 85% — sem brindes, sem chefe pedindo",
      ],
    },
    {
      n: "02",
      tone: "ia" as const,
      icon: <FileSignature className="h-5 w-5" />,
      titulo: "PGR vivo + eSocial",
      sub: "Inventário automático · S-2240 pronto",
      bullets: [
        "IA classifica respostas em riscos NR-1 (ofensores)",
        "PGR psicossocial gerado e atualizado a cada ciclo",
        "Exportação de S-2240 direto para o eSocial",
      ],
    },
    {
      n: "03",
      tone: "humano" as const,
      icon: <Stethoscope className="h-5 w-5" />,
      titulo: "Cuidado humano (NR-7)",
      sub: "Casos individuais → clínica parceira",
      bullets: [
        "Casos individuais nunca passam pela IA",
        "Encaminhamento anonimizado para psicólogo parceiro",
        "Empresa cumpre obrigação org sem invadir indivíduo",
      ],
    },
  ];

  return (
    <section className="relative border-y border-line/10 bg-navy-deep/30">
      <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <div className="mb-14 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-ia/30 bg-ia/10 px-3 py-1 text-xs font-medium text-ia">
            <Workflow className="h-3.5 w-3.5" /> Human-in-the-Loop
          </div>
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
            Como funciona em <span className="text-ia">3 passos</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted md:text-lg">
            A IA cuida da escala (NR-1 organizacional). O psicólogo cuida da pessoa
            (NR-7 individual). Nada se mistura.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {passos.map((p, i) => (
            <div key={p.titulo} className="panel relative p-6">
              {/* Seta entre cards */}
              {i < passos.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-ink-muted/40 md:block" />
              )}
              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${
                  p.tone === "ia"
                    ? "bg-ia/15 text-ia shadow-glow"
                    : "bg-humano/15 text-humano shadow-glowHuman"
                }`}
              >
                {p.icon}
              </div>
              <div
                className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  p.tone === "ia" ? "text-ia" : "text-humano"
                }`}
              >
                Passo {p.n}
              </div>
              <h3 className="mb-1 font-display text-2xl font-semibold tracking-tight text-ink">
                {p.titulo}
              </h3>
              <p className="mb-4 text-sm text-ink-muted">{p.sub}</p>
              <ul className="space-y-2 text-sm text-ink-muted">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        p.tone === "ia" ? "text-ia" : "text-humano"
                      }`}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Faixa "barreira de privacidade" */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-ia/20 bg-gradient-to-r from-ia/5 via-fill/5 to-humano/5 p-6 md:flex-row md:p-8">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-fill/5 text-ink">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold tracking-tight text-ink">
                Barreira de privacidade auditável
              </div>
              <p className="text-sm text-ink-muted">
                IA opera só sobre agregados. Indivíduo só com sigilo profissional.
                Nada cruza a barreira sem assinatura digital.
              </p>
            </div>
          </div>
          <span className="tag bg-ok/15 text-ok ring-1 ring-inset ring-ok/25">
            <ShieldCheck className="h-3.5 w-3.5" /> LGPD · Art. 11 II f
          </span>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Diferencial — tabela vs concorrência                                       */
/* -------------------------------------------------------------------------- */
function Diferencial() {
  const linhas = [
    { criterio: "NR-1 psicossocial nativa", excel: false, generica: false, previa: true },
    { criterio: "eSocial S-2240 automático", excel: false, generica: false, previa: true },
    { criterio: "Cuidado clínico via parceiro (NR-7)", excel: false, generica: false, previa: true },
    { criterio: "LGPD por design (DPIA inclusa)", excel: false, generica: "parcial", previa: true },
    { criterio: "Tempo de implantação", excel: "6+ meses", generica: "2-3 meses", previa: "2 semanas" },
    { criterio: "Atualização contínua de riscos", excel: false, generica: "manual", previa: true },
    { criterio: "Auditoria com selo digital", excel: false, generica: false, previa: true },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
      <div className="mb-12 max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-ia/30 bg-ia/10 px-3 py-1 text-xs font-medium text-ia">
          <Sparkles className="h-3.5 w-3.5" /> Por que PrevIA
        </div>
        <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
          Não é planilha. <br className="hidden md:block" />
          Não é consultoria. É plataforma.
        </h2>
        <p className="mt-4 text-base text-ink-muted md:text-lg">
          Compare com o que existe hoje no mercado brasileiro:
        </p>
      </div>

      <div className="panel overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line/10 bg-fill/5">
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Critério
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Excel + Consultoria
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Plataforma genérica de pesquisa
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-ia">
                  PrevIA
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr
                  key={l.criterio}
                  className={i % 2 === 1 ? "bg-fill/5" : ""}
                >
                  <td className="px-5 py-4 text-ink">{l.criterio}</td>
                  <CellComparativa v={l.excel} />
                  <CellComparativa v={l.generica} />
                  <CellComparativa v={l.previa} destaque />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CellComparativa({ v, destaque }: { v: boolean | string; destaque?: boolean }) {
  if (v === true) {
    return (
      <td className="px-5 py-4">
        <span
          className={`inline-flex items-center gap-1.5 text-sm font-medium ${destaque ? "text-ia" : "text-ok"}`}
        >
          <CheckCircle2 className="h-4 w-4" /> Sim
        </span>
      </td>
    );
  }
  if (v === false) {
    return (
      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          <XCircle className="h-4 w-4 text-alerta/70" /> Não
        </span>
      </td>
    );
  }
  return (
    <td className="px-5 py-4">
      <span
        className={`text-sm ${destaque ? "font-semibold text-ia" : "text-ink-muted"}`}
      >
        {v}
      </span>
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/*  Conformidade & Auditabilidade — selos regulatórios + manifesto             */
/* -------------------------------------------------------------------------- */
function ProvaSocial() {
  const selos = [
    "NR-1 · psicossocial", "NR-7 · saúde ocupacional", "NR-17 · ergonomia",
    "LGPD · Art. 7º e 11", "eSocial · S-2240", "Portaria MTE 1.419/2024",
    "Lei 14.831 · Cidade Empresa", "CFP · sigilo profissional",
    "CLT · adicional psicossocial", "ISO 45003 · saúde mental",
    "DPIA · avaliação de impacto", "K-anonimato · mín. 7",
  ];

  return (
    <section className="border-y border-line/10 bg-navy-deep/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mb-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-ia/30 bg-ia/10 px-3 py-1 text-xs font-medium text-ia">
            <ShieldCheck className="h-3.5 w-3.5" /> Conformidade & auditabilidade
          </div>
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
            Construída para passar em <br className="hidden md:block" />
            <span className="text-ia">qualquer auditoria</span>. Hoje.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted md:text-lg">
            Cada decisão da plataforma cita a norma que sustenta. Cada documento
            sai com hash SHA-256 e selo HMAC. Cadeia de evidências auditável de ponta a ponta.
          </p>
        </div>

        {/* Carrossel de selos regulatórios (no lugar de logos de cliente) */}
        <div className="relative mb-12 overflow-hidden border-y border-line/10 py-6">
          <div className="flex w-[200%] animate-scroll-x items-center gap-6">
            {[...selos, ...selos].map((s, i) => (
              <div
                key={`${s}-${i}`}
                className="shrink-0 inline-flex items-center gap-2 rounded-full border border-line/15 bg-fill/5 px-4 py-2 font-display text-sm font-medium tracking-tight text-ink-muted"
              >
                <BadgeCheck className="h-3.5 w-3.5 text-ia" />
                {s}
              </div>
            ))}
          </div>
          {/* fade nas bordas */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-navy to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-navy to-transparent" />
        </div>

        {/* Manifesto + 3 pilares à direita */}
        <div className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3">
            <div className="panel p-7 md:p-9">
              <div className="mb-4 text-5xl leading-none text-ia/40">&ldquo;</div>
              <p className="font-display text-xl leading-relaxed text-ink md:text-2xl">
                A nova NR-1 não cabe em planilha. Saúde mental no trabalho
                exige <strong>dado vivo</strong>, <strong>cuidado humano</strong> e{" "}
                <strong>auditoria com selo digital</strong>. Construímos a PrevIA
                porque ninguém mais ia construir.
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-line/10 pt-5">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-ia/15 text-ia">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-ink">
                    Fundadores · P2A Tech
                  </div>
                  <div className="text-xs text-ink-muted">
                    Engenharia + clínica + jurídico, no mesmo time.
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:col-span-2">
            <Mini
              icon={<FileSignature className="h-4 w-4" />}
              t="PGR com hash + selo"
              s="cadeia de evidências auditável"
            />
            <Mini
              icon={<Lock className="h-4 w-4" />}
              t="K-anonimato mín. 7"
              s="ninguém é identificável"
            />
            <Mini
              icon={<Stethoscope className="h-4 w-4" />}
              t="Cuidado clínico NR-7"
              s="via rede de psicólogos parceiros"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Mini({ icon, t, s }: { icon: React.ReactNode; t: string; s: string }) {
  return (
    <div className="panel flex items-center gap-3 p-4">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-ia/15 text-ia">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-ink">{t}</div>
        <div className="text-xs text-ink-muted">{s}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Para clínicas / psicólogos                                                */
/* -------------------------------------------------------------------------- */
function ParaClinicas() {
  return (
    <section
      id="parceiros"
      className="relative mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28"
    >
      <div className="grid gap-10 md:grid-cols-12 md:gap-14">
        <div className="md:col-span-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-humano/30 bg-humano/10 px-3 py-1 text-xs font-medium text-humano">
            <Stethoscope className="h-3.5 w-3.5" /> Para psicólogos parceiros
          </div>
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
            Pacientes que <span className="text-humano">já chegam triados</span>.
          </h2>
          <p className="mt-4 text-base text-ink-muted md:text-lg">
            A PrevIA faz a parte chata: capta, classifica, agenda, anonimiza. Você
            faz o que sabe fazer: <strong className="text-ink">cuidar</strong>.
          </p>

          <ul className="mt-7 space-y-3 text-sm text-ink-muted">
            {[
              { t: "0 CAC", d: "Zero custo de aquisição. Empresa paga pelo serviço." },
              { t: "0 secretária", d: "Agenda, lembrete, transcrição automática — tudo na plataforma." },
              { t: "Você define o honorário", d: "Sem leilão. Sem comissão escondida. Você diz o seu valor." },
              { t: "Trabalho remoto", d: "Atende de onde estiver. Brasil inteiro. Inclusive horário noturno se quiser." },
              { t: "Caso já contextualizado", d: "Recebe o ofensor que disparou + histórico de pulsos da pessoa, anonimizado." },
            ].map((b) => (
              <li key={b.t} className="flex items-start gap-3">
                <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-humano/15 text-humano">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <strong className="text-ink">{b.t}</strong>
                  <span className="ml-1.5 text-ink-muted">— {b.d}</span>
                </div>
              </li>
            ))}
          </ul>

          <a
            href="#formulario"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-humano px-6 py-3.5 text-sm font-semibold text-onaccent shadow-glowHuman transition hover:brightness-110"
          >
            Quero ser parceiro <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Visual clínica */}
        <div className="md:col-span-7">
          <div className="panel relative overflow-hidden p-6 shadow-glowHuman">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-humano/15 text-humano">
                  <Headphones className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-muted">
                    Portal da Clínica
                  </div>
                  <div className="font-display text-sm font-semibold text-ink">
                    Casos pendentes · 3
                  </div>
                </div>
              </div>
              <span className="tag bg-humano/15 text-humano ring-1 ring-inset ring-humano/25">
                NR-7
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  ofensor: "Sobrecarga de trabalho",
                  setor: "Operações · 14 dias de pulso",
                  prio: "Alta",
                  cor: "alerta",
                },
                {
                  ofensor: "Conflito com liderança",
                  setor: "Comercial · 2 ciclos consecutivos",
                  prio: "Média",
                  cor: "humano-soft",
                },
                {
                  ofensor: "Jornada/descanso insuficiente",
                  setor: "Logística · noturno",
                  prio: "Média",
                  cor: "humano-soft",
                },
              ].map((c) => (
                <div
                  key={c.ofensor}
                  className="flex items-center justify-between rounded-xl border border-line/10 bg-fill/5 p-3.5"
                >
                  <div>
                    <div className="text-sm font-medium text-ink">{c.ofensor}</div>
                    <div className="text-xs text-ink-muted">{c.setor}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`tag ${
                        c.cor === "alerta"
                          ? "bg-alerta/15 text-alerta ring-1 ring-inset ring-alerta/25"
                          : "bg-humano/15 text-humano ring-1 ring-inset ring-humano/25"
                      }`}
                    >
                      {c.prio}
                    </span>
                    <button className="rounded-lg bg-humano px-3 py-1.5 text-xs font-semibold text-onaccent">
                      Atender
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-line/10 bg-fill/5 p-4">
              <div className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-muted">
                Honorário recebido este mês
              </div>
              <div className="flex items-end gap-3">
                <div className="font-display text-3xl font-semibold tracking-tight text-ink">
                  R$ 18.420
                </div>
                <div className="text-xs text-ok">+ R$ 2.150 em fila</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  FAQ                                                                       */
/* -------------------------------------------------------------------------- */
function FAQ() {
  const faqs = [
    {
      q: "O que mudou na nova NR-1?",
      a: "A Portaria MTE 1.419/2024 atualizou as obrigações de gerenciamento de riscos ocupacionais e, pela primeira vez no Brasil, exige que riscos psicossociais sejam tratados no PGR como qualquer outro risco. Em vigor desde maio de 2025.",
    },
    {
      q: "Quem precisa cumprir?",
      a: "Toda empresa com CNPJ que tenha pelo menos 1 empregado CLT. Tamanho não importa — MEI e microempresa com funcionário também. Empresas com 20+ funcionários têm CIPA, que precisa documentar a gestão.",
    },
    {
      q: "Qual o prazo de adequação?",
      a: "Já está em vigor. Não existe prazo adicional. Auditores podem autuar a qualquer momento por descumprimento.",
    },
    {
      q: "Como a PrevIA respeita a LGPD?",
      a: "Por design. A IA opera só sobre agregados (k-anonimato mínimo de 7 pessoas) — ninguém é identificável. Casos individuais ficam com clínica parceira sob sigilo profissional. Temos DPIA documentada e DPO designado (dpo@p2a.tech).",
    },
    {
      q: "Posso manter minha consultoria de SST atual?",
      a: "Sim. A PrevIA gera os dados e o PGR psicossocial. Sua consultoria continua cuidando da parte ocupacional, PCMSO e demais NRs. Somos complementares — não substituímos médico do trabalho nem engenheiro de segurança.",
    },
    {
      q: "Quanto custa?",
      a: "Cobrança por colaborador/mês, com piso e teto. A demonstração de 20 minutos inclui orçamento personalizado. Em geral o investimento paga em 1 (uma) multa evitada.",
    },
    {
      q: "Como é a coleta com os colaboradores?",
      a: "Pulsos curtos por WhatsApp — 7 perguntas, cerca de 90 segundos. Adesão típica entre 72 e 85%, sem brinde nem chefe pedindo. Você define a frequência (quinzenal, mensal etc).",
    },
    {
      q: "Funciona pra empresa pequena ou média?",
      a: "Funciona. Temos plano para empresas a partir de 50 colaboradores. Abaixo disso, oferecemos o pacote 'NR-1 essencial' (sem escuta ativa contínua, só PGR + cuidado humano sob demanda).",
    },
  ];

  return (
    <section className="border-y border-line/10 bg-navy-deep/30 py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line/15 bg-fill/5 px-3 py-1 text-xs font-medium text-ink-muted">
            FAQ
          </div>
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
            Perguntas frequentes.
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details
              key={f.q}
              className="panel group p-0 transition open:border-ia/25"
              {...(i === 0 ? { open: true } : {})}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
                <span className="font-display text-base font-semibold text-ink md:text-lg">
                  {f.q}
                </span>
                <span className="shrink-0 grid h-7 w-7 place-items-center rounded-full bg-fill/5 text-ink-muted transition group-open:rotate-45 group-open:bg-ia/15 group-open:text-ia">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 pt-0">
                <p className="text-sm leading-relaxed text-ink-muted">{f.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  CTA Final + formulário                                                    */
/* -------------------------------------------------------------------------- */
function CTAFinal() {
  return (
    <section id="formulario" className="relative isolate py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ia/10 blur-[140px]" />
        <div className="absolute right-1/3 top-0 h-[280px] w-[480px] rounded-full bg-humano/10 blur-[120px]" />
      </div>
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <div className="mb-9 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-ia/30 bg-ia/10 px-3 py-1 text-xs font-medium text-ia">
            <Sparkles className="h-3.5 w-3.5" /> Demo gratuita · 20 minutos
          </div>
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
            20 minutos. Sem comercial. <br className="hidden md:block" />
            <span className="text-ink-muted">Sem PowerPoint.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted md:text-lg">
            Mostramos a plataforma rodando com dados reais. Você sai sabendo se compensa.
            Sem te empurrar contrato.
          </p>
        </div>
        <LeadForm tipoInicial="empresa" id="formulario-card" />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Footer                                                                    */
/* -------------------------------------------------------------------------- */
function Footer() {
  return (
    <footer className="border-t border-line/10 bg-navy-deep/40 py-12">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-ia text-onaccent">
                <Brain className="h-4 w-4" />
              </div>
              <div className="leading-none">
                <div className="font-display text-lg font-semibold tracking-tight text-ink">
                  PrevIA
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                  por P2A Tech
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm text-ink-muted">
              Plataforma brasileira de IA para conformidade com a NR-1 e gestão
              de riscos psicossociais. Human-in-the-Loop · LGPD por design.
            </p>
          </div>

          <div>
            <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              Plataforma
            </div>
            <ul className="space-y-2 text-sm text-ink-muted">
              <li><Link href="/login" className="hover:text-ink">Acessar</Link></li>
              <li><a href="#formulario" className="hover:text-ink">Falar conosco</a></li>
              <li><a href="#parceiros" className="hover:text-ink">Parceiros clínicos</a></li>
            </ul>
          </div>

          <div>
            <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              Privacidade
            </div>
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>
                <a href="mailto:dpo@p2a.tech" className="hover:text-ink">
                  DPO · dpo@p2a.tech
                </a>
              </li>
              <li>
                <a href="mailto:contato@p2a.tech" className="hover:text-ink">
                  Contato · contato@p2a.tech
                </a>
              </li>
              <li className="text-[11px] text-ink-muted/70">LGPD · Art. 7º I, II, IV, IX</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line/10 pt-6 text-xs text-ink-muted md:flex-row">
          <span>© {new Date().getFullYear()} P2A Tech · Todos os direitos reservados.</span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-ok" /> Conforme NR-1 (Portaria MTE 1.419/2024)
          </span>
        </div>
      </div>
    </footer>
  );
}
