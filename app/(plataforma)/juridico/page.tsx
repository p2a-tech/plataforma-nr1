import Link from "next/link";
import {
  Scale,
  ShieldCheck,
  FileSignature,
  CalendarClock,
  GitBranch,
  Database,
  AlertTriangle,
  Landmark,
  FileText,
  HeartHandshake,
  Cpu,
  Lock,
  ExternalLink,
  CheckCircle2,
  Clock,
  Gavel,
  Sparkles,
  ArrowUpRight,
  Mail,
  BookOpen,
  Send,
  FileWarning,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge, ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { empresa } from "@/lib/mock-data";
import {
  getConformidade,
  getPgrStatus,
  getResumo,
  getInventarioRiscos,
} from "@/lib/queries";
import { getResumoJuridico } from "@/lib/juridico";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/* ============================================================================
 *  BASE LEGAL aplicável a PrevIA (vigente em 2026).
 *  Tipo: "obrigacao" (devida ao Estado/empregado) | "direito" (proteção a terceiros)
 * ========================================================================= */
const BASE_LEGAL: {
  id: string;
  norma: string;
  ementa: string;
  vigencia: string;
  tipo: "obrigacao" | "direito" | "tecnica";
  link: string;
  aplicacao: string;
}[] = [
  {
    id: "nr-1",
    norma: "NR-1 (Portaria MTE 1.419/2024)",
    ementa: "Gestão de Saúde e Segurança do Trabalho · obriga inventário e PGR para riscos psicossociais.",
    vigencia: "Vigente desde 26/05/2026",
    tipo: "obrigacao",
    link: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/normas-regulamentadoras/nr-01.pdf",
    aplicacao: "Base do PGR vivo, da escuta ativa e do plano de ação.",
  },
  {
    id: "nr-7",
    norma: "NR-7 (PCMSO)",
    ementa: "Programa de Controle Médico de Saúde Ocupacional — exames e acompanhamento clínico individual.",
    vigencia: "Vigente",
    tipo: "obrigacao",
    link: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/normas-regulamentadoras/nr-07.pdf",
    aplicacao: "Lado humano (clínica): atendimento individual fica fora da barreira.",
  },
  {
    id: "nr-17",
    norma: "NR-17",
    ementa: "Ergonomia — inclui carga mental, ritmo de trabalho e organização (interface com risco psicossocial).",
    vigencia: "Vigente",
    tipo: "tecnica",
    link: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/normas-regulamentadoras/nr-17.pdf",
    aplicacao: "Plano de ação organizacional (ritmo, jornada, autonomia).",
  },
  {
    id: "lgpd",
    norma: "LGPD · Lei 13.709/2018",
    ementa: "Tratamento de dados pessoais. Saúde mental é dado sensível (art. 11).",
    vigencia: "Vigente",
    tipo: "direito",
    link: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm",
    aplicacao: "Bases legais por finalidade (escuta, atendimento, compliance) — ver DPIA.",
  },
  {
    id: "clt-157",
    norma: "CLT · arts. 157 e 158",
    ementa: "Dever do empregador de cumprir e fazer cumprir normas de SST.",
    vigencia: "Vigente",
    tipo: "obrigacao",
    link: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm",
    aplicacao: "Fundamento da responsabilização — defesa via cadeia de evidências.",
  },
  {
    id: "lei-14831",
    norma: "Lei 14.831/2024",
    ementa: "Programa Empresa Promotora da Saúde Mental — selo de empresa promotora.",
    vigencia: "Vigente",
    tipo: "direito",
    link: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/L14831.htm",
    aplicacao: "Posicionamento institucional + selo voluntário.",
  },
  {
    id: "esocial",
    norma: "Manual eSocial v.S-1.3",
    ementa: "Eventos S-2210 (CAT), S-2220 (ASO), S-2240 (riscos ambientais) com camada psicossocial.",
    vigencia: "Vigente",
    tipo: "obrigacao",
    link: "https://www.gov.br/esocial/pt-br",
    aplicacao: "Transmissão automatizada via Conformidade & eSocial.",
  },
  {
    id: "cfp-cfm",
    norma: "Res. CFP 11/2018 + CFM 1.643/2002",
    ementa: "Sigilo profissional em telessaúde mental e médica.",
    vigencia: "Vigente",
    tipo: "direito",
    link: "https://site.cfp.org.br/",
    aplicacao: "A barreira de sigilo é imposta no código (Zod + HMAC).",
  },
];

/* ============================================================================
 *  DPIA — finalidades de tratamento e bases legais LGPD.
 * ========================================================================= */
const DPIA: {
  finalidade: string;
  baseLegal: string;
  artigo: string;
  retencao: string;
  risco: "baixo" | "medio" | "alto";
  controles: string;
}[] = [
  {
    finalidade: "Escuta ativa (micro-pulsos WhatsApp)",
    baseLegal: "Consentimento explícito · termo versionado",
    artigo: "Art. 7º I + Art. 11 I",
    retencao: "12 meses (anônimo)",
    risco: "baixo",
    controles: "Telefone apenas como hash · k-anonymity (k≥7) · revogação por canal",
  },
  {
    finalidade: "Atendimento clínico (telemedicina)",
    baseLegal: "Tutela da saúde · profissional regulado",
    artigo: "Art. 11 II c",
    retencao: "Permanece na clínica (sigilo)",
    risco: "medio",
    controles: "Conteúdo nunca atravessa a barreira · só ofensores genéricos agregados",
  },
  {
    finalidade: "PGR e inventário de riscos (compliance NR-1)",
    baseLegal: "Cumprimento de obrigação legal",
    artigo: "Art. 7º II",
    retencao: "20 anos (NR-7) ou enquanto durar o vínculo",
    risco: "baixo",
    controles: "Hash + selo HMAC · validação humana assinada",
  },
  {
    finalidade: "eSocial e relatórios regulatórios",
    baseLegal: "Cumprimento de obrigação legal",
    artigo: "Art. 7º II",
    retencao: "Conforme tabela eSocial",
    risco: "baixo",
    controles: "Transmissão por API · trilha de auditoria criptografada",
  },
  {
    finalidade: "Auditoria interna / quebra do nexo causal",
    baseLegal: "Legítimo interesse",
    artigo: "Art. 7º IX + Art. 10",
    retencao: "12 meses (audit log)",
    risco: "baixo",
    controles: "Audit log sem payload · só metadados",
  },
  {
    finalidade: "Risco grave/iminente · protocolo de emergência",
    baseLegal: "Proteção da vida e da incolumidade",
    artigo: "Art. 7º IV + Art. 11 II f",
    retencao: "Registro permanente do acionamento",
    risco: "alto",
    controles: "Única exceção ao anonimato · decisão humana registrada",
  },
];

const TONE_RISCO: Record<(typeof DPIA)[number]["risco"], "ok" | "ambar" | "alerta"> = {
  baixo: "ok",
  medio: "ambar",
  alto: "alerta",
};
const LABEL_RISCO: Record<(typeof DPIA)[number]["risco"], string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};
const TONE_NORMA: Record<(typeof BASE_LEGAL)[number]["tipo"], "ia" | "humano" | "ambar"> = {
  obrigacao: "ambar",
  direito: "ia",
  tecnica: "humano",
};
const LABEL_NORMA = {
  obrigacao: "Obrigação",
  direito: "Direito/Proteção",
  tecnica: "Norma técnica",
} as const;

/* ============================================================================
 *  CONTRATOS E TERMOS vigentes (modelo enquanto repositório real não chega).
 * ========================================================================= */
const CONTRATOS = [
  { nome: "Termo de consentimento (micro-pulso WhatsApp)", versao: "v1", status: "real", vigencia: "vigente · banco" },
  { nome: "Contrato com clínica parceira", versao: "v1.2", status: "modelo", vigencia: "renovação 12/2026" },
  { nome: "Política interna de Privacidade (LGPD)", versao: "v2", status: "modelo", vigencia: "rev. anual" },
  { nome: "Política de Retenção e Eliminação", versao: "v1", status: "real", vigencia: "12 meses respostas / 30d sessões" },
  { nome: "Protocolo de Risco Grave/Iminente", versao: "v1", status: "modelo", vigencia: "rev. semestral" },
  { nome: "DPIA · PrevIA (este documento)", versao: "v1", status: "real", vigencia: "atualizado a cada release" },
];

/* ============================================================================
 *  CALENDÁRIO de obrigações (deriva do estado real onde possível).
 * ========================================================================= */
function diasAteIso(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default async function JuridicoPage() {
  const sessao = exigirSessao(["sst", "admin"]);
  const [conf, pgr, resumo, riscos, jur] = await withEmpresa(sessao.empresa_id, () =>
    Promise.all([getConformidade(), getPgrStatus(), getResumo(), getInventarioRiscos(), getResumoJuridico()]),
  );

  const okItens = conf.checklist.filter((c) => c.status === "ok").length;
  const totalItens = conf.checklist.length;
  const conformidadePct = conf.conformidade;

  const naoConformes = conf.checklist.filter((c) => c.status !== "ok");
  const criticosOuAltos = riscos.riscos.filter((r) => r.severidade * r.probabilidade >= 9);

  // Calendário derivado:
  const hoje = new Date();
  const nextMes = (m: number) =>
    new Date(hoje.getFullYear(), hoje.getMonth() + m, 15).toISOString();

  const obrigacoes = [
    {
      acao: "Revisão e assinatura do PGR",
      norma: "NR-1",
      prazo: pgr.pendente ? "Pendente · hoje" : nextMes(3),
      responsavel: "Eng. Segurança / SESMT",
      status: pgr.pendente ? ("atrasado" as const) : ("em-dia" as const),
      link: "/pgr",
    },
    {
      acao: "Transmissão S-2240 do mês",
      norma: "eSocial",
      prazo: nextMes(0),
      responsavel: "SST / DP",
      status: "em-dia" as const,
      link: "/conformidade",
    },
    {
      acao: "Treinamento de lideranças em fatores psicossociais",
      norma: "NR-1",
      prazo: nextMes(2),
      responsavel: "RH · Desenvolvimento",
      status: naoConformes.some((c) => c.item.includes("Treinamento"))
        ? ("proximo" as const)
        : ("em-dia" as const),
      link: "/riscos",
    },
    {
      acao: "Renovação do contrato com clínica parceira",
      norma: "LGPD + CLT",
      prazo: nextMes(6),
      responsavel: "Jurídico",
      status: "em-dia" as const,
      link: "#contratos",
    },
    {
      acao: "Job de retenção (anonimização > 12m)",
      norma: "LGPD art. 16",
      prazo: nextMes(1),
      responsavel: "Plataforma · automatizado",
      status: "em-dia" as const,
      link: "#",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Compliance Jurídico"
        descricao={`${empresa.nome}. Base legal aplicável, evidências, DPIA/LGPD, contratos vigentes e calendário de obrigações — pronto para auditoria e defesa em litígio.`}
        badge={
          <Badge tone="ia">
            <Scale className="h-3 w-3" /> Visão consolidada · DPO
          </Badge>
        }
      />

      {/* ============== HERO STRIP ============== */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<ShieldCheck className="h-5 w-5" />}
          titulo="Conformidade NR-1"
          valor={`${conformidadePct}%`}
          legenda={`${okItens}/${totalItens} itens em ordem`}
          tone={conformidadePct >= 80 ? "ok" : "ambar"}
        />
        <KpiCard
          icon={<Lock className="h-5 w-5" />}
          titulo="LGPD · consentimentos"
          valor={jur.consentimentosTotal.toLocaleString("pt-BR")}
          legenda={`Termo vigente: ${jur.termoVigenteVersao ?? "—"} · +${jur.consentimentosUltimoDia} em 24h`}
          tone="ia"
        />
        <KpiCard
          icon={<FileSignature className="h-5 w-5" />}
          titulo="PGR vigente"
          valor={pgr.pendente ? `→ rev ${pgr.proximaRevisao}` : `rev ${pgr.revisaoVigente}`}
          legenda={pgr.pendente ? "Assinatura humana pendente" : `Por ${pgr.ultima?.assinante_nome}`}
          tone={pgr.pendente ? "ambar" : "ok"}
          href="/pgr"
        />
        <KpiCard
          icon={<Database className="h-5 w-5" />}
          titulo="Cadeia auditável"
          valor={`${jur.auditAceitos}/${jur.auditAceitos + jur.auditRejeitados}`}
          legenda={`webhooks aceitos · ${jur.auditRejeitados} rejeitados`}
          tone="ok"
        />
      </div>

      {/* ============== CADEIA DE EVIDÊNCIAS ============== */}
      <Card>
        <CardTitle
          icon={<GitBranch className="h-5 w-5" />}
          hint="Evidência viva da diligência empresarial — “quebra o nexo causal” em litígio trabalhista."
          action={<Badge tone="ok">Defesa em juízo</Badge>}
        >
          Cadeia de evidências (Escuta → Cuidado → Ação → Compliance)
        </CardTitle>
        <div className="grid gap-3 md:grid-cols-4">
          <Elo
            tone="ia"
            n={1}
            titulo="Escuta"
            valor={resumo.totalAtendimentos}
            sufixo="atendimentos"
            descricao="Sinais detectados nos clusters anônimos (NR-1 + LGPD k-anon)."
          />
          <Elo
            tone="humano"
            n={2}
            titulo="Cuidado"
            valor={jur.pulsoSessoesAtivas + jur.consentimentosTotal}
            sufixo="acolhimentos"
            descricao="Acolhimento clínico em sigilo (Res. CFP 11/2018)."
          />
          <Elo
            tone="ia"
            n={3}
            titulo="Ação"
            valor={riscos.riscos.length}
            sufixo="riscos com plano"
            descricao="Plano de ação organizacional registrado no PGR vivo."
          />
          <Elo
            tone="ok"
            n={4}
            titulo="Compliance"
            valor={pgr.historico.length}
            sufixo="revisões PGR"
            descricao="Cada revisão tem hash + selo HMAC — auditável."
          />
        </div>
        <p className="mt-4 rounded-xl border border-line/5 bg-fill/[0.02] p-3 text-xs leading-relaxed text-ink/75">
          <Gavel className="-mt-0.5 mr-1.5 inline h-3.5 w-3.5 text-ia" />
          Esta cadeia documenta, em ordem temporal, que a empresa percebeu o sinal de risco, agiu
          sobre ele e atualizou o PGR. Em ação trabalhista (assédio moral, transtornos
          psicossociais), isto demonstra <strong>diligência</strong> e <strong>quebra o nexo causal</strong>{" "}
          (CLT art. 157 + NR-1).
        </p>
      </Card>

      {/* ============== BASE LEGAL ============== */}
      <Card>
        <CardTitle
          icon={<BookOpen className="h-5 w-5" />}
          hint="Normas vigentes que orientam o produto e o compliance da empresa."
          action={<Badge tone="neutro">{BASE_LEGAL.length} normas</Badge>}
        >
          Base legal aplicável
        </CardTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {BASE_LEGAL.map((n) => (
            <div
              key={n.id}
              className="rounded-xl border border-line/5 bg-fill/[0.02] p-3.5 transition-colors hover:bg-fill/[0.04]"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone={TONE_NORMA[n.tipo]}>{LABEL_NORMA[n.tipo]}</Badge>
                <span className="text-sm font-medium text-ink">{n.norma}</span>
                <a
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-ia hover:underline"
                  title="Texto integral"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="text-xs leading-relaxed text-ink/75">{n.ementa}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
                <span>{n.vigencia}</span>
                <span className="text-ia">{n.aplicacao}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ============== CALENDÁRIO DE OBRIGAÇÕES ============== */}
      <Card>
        <CardTitle
          icon={<CalendarClock className="h-5 w-5" />}
          hint="Datas-chave derivadas do estado real do PGR, eSocial e plano de ação."
          action={
            <Badge tone={obrigacoes.some((o) => o.status === "atrasado") ? "alerta" : "ok"}>
              {obrigacoes.filter((o) => o.status === "atrasado").length} atrasada(s)
            </Badge>
          }
        >
          Calendário de obrigações
        </CardTitle>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line/10 text-left text-xs uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-2 py-2 font-medium">Obrigação</th>
                <th scope="col" className="px-2 py-2 font-medium">Norma</th>
                <th scope="col" className="px-2 py-2 font-medium">Prazo</th>
                <th scope="col" className="px-2 py-2 font-medium">Responsável</th>
                <th scope="col" className="px-2 py-2 font-medium">Status</th>
                <th scope="col" className="px-2 py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {obrigacoes.map((o, i) => (
                <tr key={i} className="border-b border-line/5 align-top hover:bg-fill/[0.03]">
                  <td className="px-2 py-3 font-medium text-ink">{o.acao}</td>
                  <td className="px-2 py-3 text-ink-muted">{o.norma}</td>
                  <td className="px-2 py-3 whitespace-nowrap text-ink-muted">
                    {o.prazo.includes("Pendente") ? o.prazo : prazoLabel(o.prazo)}
                  </td>
                  <td className="px-2 py-3 text-ink-muted">{o.responsavel}</td>
                  <td className="px-2 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-2 py-3">
                    <Link
                      href={o.link}
                      className="inline-flex items-center gap-1 text-xs text-ia hover:underline"
                    >
                      Abrir <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {obrigacoes.map((o, i) => (
            <div key={i} className="rounded-xl border border-line/5 bg-fill/[0.02] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{o.acao}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-1 text-xs text-ink-muted">{o.norma} · {o.responsavel}</div>
              <div className="mt-1 text-xs text-ink-muted">{prazoLabel(o.prazo)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ============== DPIA / AIPD ============== */}
      <Card>
        <CardTitle
          icon={<FileText className="h-5 w-5" />}
          hint="Avaliação de Impacto à Proteção de Dados — finalidades, bases legais e riscos por tratamento."
          action={<Badge tone="ia">LGPD art. 38</Badge>}
        >
          DPIA / AIPD — finalidades de tratamento
        </CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line/10 text-left text-xs uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-2 py-2 font-medium">Finalidade</th>
                <th scope="col" className="px-2 py-2 font-medium">Base legal</th>
                <th scope="col" className="px-2 py-2 font-medium">Artigo</th>
                <th scope="col" className="px-2 py-2 font-medium">Retenção</th>
                <th scope="col" className="px-2 py-2 font-medium">Risco</th>
                <th scope="col" className="px-2 py-2 font-medium">Controles</th>
              </tr>
            </thead>
            <tbody>
              {DPIA.map((d, i) => (
                <tr key={i} className="border-b border-line/5 align-top hover:bg-fill/[0.03]">
                  <td className="px-2 py-3 font-medium text-ink">{d.finalidade}</td>
                  <td className="px-2 py-3 text-ink/85">{d.baseLegal}</td>
                  <td className="px-2 py-3 whitespace-nowrap font-mono text-xs text-ia">
                    {d.artigo}
                  </td>
                  <td className="px-2 py-3 text-ink-muted">{d.retencao}</td>
                  <td className="px-2 py-3">
                    <Badge tone={TONE_RISCO[d.risco]}>{LABEL_RISCO[d.risco]}</Badge>
                  </td>
                  <td className="px-2 py-3 max-w-[260px] text-xs leading-relaxed text-ink/75">
                    {d.controles}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ============== RISCOS JURÍDICOS ============== */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle
            icon={<AlertTriangle className="h-5 w-5" />}
            hint="Gap analysis NR-1 + LGPD + projeção previdenciária (FAP/NTEP)."
            action={
              <Badge tone={naoConformes.length === 0 ? "ok" : "humano"}>
                {naoConformes.length} gaps
              </Badge>
            }
          >
            Riscos jurídicos identificados
          </CardTitle>
          {naoConformes.length === 0 ? (
            <p className="py-4 text-sm text-ok">Sem itens não-conformes no checklist NR-1.</p>
          ) : (
            <ul className="space-y-2">
              {naoConformes.map((c, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-line/5 bg-fill/[0.02] p-2.5">
                  <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-humano" />
                  <div>
                    <div className="text-sm font-medium text-ink">{c.item}</div>
                    <div className="text-xs text-ink-muted">{c.descricao}</div>
                  </div>
                  <Badge tone={c.status === "atencao" ? "humano" : "ambar"} className="ml-auto shrink-0">
                    {c.status === "atencao" ? "Atenção" : "Pendente"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line/5 pt-4">
            <MiniMetric
              label="Riscos críticos + altos"
              valor={String(criticosOuAltos.length)}
              tone={criticosOuAltos.length > 0 ? "alerta" : "ok"}
              sub="Inventário NR-1"
            />
            <MiniMetric
              label="Acionamentos de emergência"
              valor={String(jur.protocoloEmergenciaContagem)}
              tone={jur.protocoloEmergenciaContagem > 0 ? "humano" : "ok"}
              sub="Exceção controlada ao anonimato"
            />
          </div>
        </Card>

        <Card>
          <CardTitle
            icon={<Landmark className="h-5 w-5" />}
            hint="Comunicação com órgãos reguladores e canal de fiscalização."
          >
            Comunicação regulatória
          </CardTitle>
          <ul className="space-y-2.5 text-sm">
            <ItemReg
              icon={<Send className="h-4 w-4 text-ia" />}
              titulo="eSocial"
              meta="Eventos S-2210/2220/2240 transmitidos automaticamente"
              acao={<Badge tone="ok">Ativo</Badge>}
            />
            <ItemReg
              icon={<Gavel className="h-4 w-4 text-humano" />}
              titulo="MPT / MTE"
              meta="Canal para fiscalização — encarregado SST mantém contato"
              acao={<Badge tone="ambar">Modelo</Badge>}
            />
            <ItemReg
              icon={<Mail className="h-4 w-4 text-ia" />}
              titulo="ANPD · DPO"
              meta="Encarregado de dados pessoais designado e divulgado"
              acao={<Badge tone="ambar">Designar</Badge>}
            />
            <ItemReg
              icon={<HeartHandshake className="h-4 w-4 text-humano" />}
              titulo="Sindicato laboral"
              meta="Comunicação prévia para mudanças em escala/jornada"
              acao={<Badge tone="ambar">Modelo</Badge>}
            />
            <ItemReg
              icon={<Cpu className="h-4 w-4 text-ia" />}
              titulo="Clínica parceira"
              meta="Contrato vigente · troca apenas dados agregados/anônimos"
              acao={<Badge tone="ok">Vigente</Badge>}
            />
          </ul>
        </Card>
      </div>

      {/* ============== CONTRATOS & TERMOS ============== */}
      <Card id="contratos">
        <CardTitle
          icon={<FileSignature className="h-5 w-5" />}
          hint="Repositório de instrumentos jurídicos vigentes. Itens marcados “modelo” aguardam upload do real."
          action={<Badge tone="neutro">{CONTRATOS.length} documentos</Badge>}
        >
          Contratos e termos vigentes
        </CardTitle>
        <div className="space-y-2">
          {CONTRATOS.map((c, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line/5 bg-fill/[0.02] p-3 text-sm"
            >
              <FileText className="h-4 w-4 text-ia" />
              <span className="font-medium text-ink">{c.nome}</span>
              <Badge tone="neutro">{c.versao}</Badge>
              <span className="ml-auto text-xs text-ink-muted">{c.vigencia}</span>
              {c.status === "real" ? (
                <Badge tone="ok">
                  <CheckCircle2 className="h-3 w-3" /> em vigor
                </Badge>
              ) : (
                <Badge tone="ambar">
                  <Clock className="h-3 w-3" /> modelo
                </Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ============== RODAPÉ DE GOVERNANÇA ============== */}
      <Card className="bg-gradient-to-r from-ia/[0.06] via-transparent to-humano/[0.05]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-ia" />
            <div>
              <div className="text-sm font-medium text-ink">Defesa em profundidade</div>
              <p className="text-xs text-ink-muted">
                Privacidade por desenho (k-anonymity, HMAC, RLS) + decisão humana assinada + cadeia
                de evidências cripto-verificável.
              </p>
            </div>
          </div>
          <Link
            href="/pgr"
            className="inline-flex items-center gap-2 rounded-xl border border-ia/25 bg-ia/10 px-4 py-2.5 text-sm font-medium text-ia transition hover:bg-ia/20"
          >
            <FileSignature className="h-4 w-4" /> Ir para o PGR assinável
          </Link>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
 *  Helpers visuais
 * ========================================================================= */
function KpiCard({
  icon,
  titulo,
  valor,
  legenda,
  tone,
  href,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  legenda: string;
  tone: "ok" | "ia" | "ambar" | "alerta";
  href?: string;
}) {
  const color = {
    ok: "text-ok",
    ia: "text-ia",
    ambar: "text-humano-soft",
    alerta: "text-alerta",
  }[tone];
  const card = (
    <Card className="h-full p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <span className={cn("inline-flex", color)}>{icon}</span>
        {titulo}
      </div>
      <div className={cn("mt-1.5 font-display text-2xl font-semibold tracking-tight", color)}>
        {valor}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{legenda}</p>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function Elo({
  tone,
  n,
  titulo,
  valor,
  sufixo,
  descricao,
}: {
  tone: "ia" | "humano" | "ok";
  n: number;
  titulo: string;
  valor: number;
  sufixo: string;
  descricao: string;
}) {
  const ring = {
    ia: "ring-ia/30 bg-ia/10",
    humano: "ring-humano/30 bg-humano/10",
    ok: "ring-ok/30 bg-ok/10",
  }[tone];
  const text = { ia: "text-ia", humano: "text-humano", ok: "text-ok" }[tone];
  return (
    <div className="rounded-xl border border-line/5 bg-fill/[0.02] p-3.5">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg ring-1", ring, text)}>
          {n}
        </span>
        <span className="text-sm font-medium text-ink">{titulo}</span>
      </div>
      <div className={cn("mt-2 font-display text-xl font-semibold", text)}>
        {valor.toLocaleString("pt-BR")}{" "}
        <span className="text-xs font-medium text-ink-muted">{sufixo}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{descricao}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: "em-dia" | "proximo" | "atrasado" }) {
  if (status === "atrasado")
    return (
      <Badge tone="alerta">
        <AlertTriangle className="h-3 w-3" /> Atrasado
      </Badge>
    );
  if (status === "proximo")
    return (
      <Badge tone="ambar">
        <Clock className="h-3 w-3" /> Próximo
      </Badge>
    );
  return (
    <Badge tone="ok">
      <CheckCircle2 className="h-3 w-3" /> Em dia
    </Badge>
  );
}

function prazoLabel(iso: string): string {
  const d = new Date(iso);
  const dias = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const fmt = d.toLocaleDateString("pt-BR");
  if (dias < 0) return `${fmt} · ${-dias}d atrasado`;
  if (dias === 0) return `${fmt} · hoje`;
  return `${fmt} · em ${dias}d`;
}

function MiniMetric({
  label,
  valor,
  sub,
  tone,
}: {
  label: string;
  valor: string;
  sub: string;
  tone: "ok" | "alerta" | "humano";
}) {
  const color = { ok: "text-ok", alerta: "text-alerta", humano: "text-humano" }[tone];
  return (
    <div className="rounded-xl border border-line/5 bg-fill/[0.02] p-3">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className={cn("mt-0.5 font-display text-xl font-semibold", color)}>{valor}</div>
      <div className="text-[11px] text-ink-muted">{sub}</div>
    </div>
  );
}

function ItemReg({
  icon,
  titulo,
  meta,
  acao,
}: {
  icon: React.ReactNode;
  titulo: string;
  meta: string;
  acao: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line/5 bg-fill/[0.02] p-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-fill/5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{titulo}</div>
        <div className="text-xs text-ink-muted">{meta}</div>
      </div>
      {acao}
    </li>
  );
}
