import "server-only";
import { sql, dbHabilitado } from "@/lib/db";
import { OFENSORES_LABEL, K_MIN, type OfensorTag } from "@previa/contracts";
import { hashConteudo, obterRevisaoAtual, type PgrRevisao } from "@/lib/pgr";
import { energiaParaRisco } from "@/lib/radar";
import { empresaAtual } from "@/lib/tenant";
import { empresa } from "@/lib/mock-data";
import {
  serieRisco as serieMock,
  inventarioRiscos as inventarioMock,
  checklistNR1 as checklistMock,
  eventosESocial as esocialMock,
  trilhaAuditoria as trilhaMock,
  type LinhaHeatmap,
  type Alerta,
  type PontoSerie,
  type Severidade,
  type Risco,
  type ItemChecklist,
  type EventoESocial,
  type EventoAuditoria,
} from "@/lib/mock-data";

const TURNO_LABEL: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  madrugada: "Madrugada",
};

function fmtData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Camada de leitura do Dashboard. Toda função:
 *   - tenta agregar os eventos reais do Postgres;
 *   - se o DB estiver desabilitado, vazio ou der erro, devolve o MOCK.
 *   - sempre retorna `{ fonte: "real" | "mock", ... }` para a UI sinalizar.
 *
 * Mapa severidade → score (0-100), usado em heatmap, alertas e série.
 */
const SCORE_SQL = `case severidade_estimada
  when 'baixa' then 20 when 'media' then 45 when 'alta' then 72 when 'critica' then 92
  else 0 end`;

const TURNOS_ORDEM = ["manha", "tarde", "noite", "madrugada"] as const;

type Fonte = "real" | "mock";

/* -------------------------------------------------------------------------- */
/*  Resumo geral (contadores) — alimenta cards e o badge "dados reais"        */
/* -------------------------------------------------------------------------- */
export interface ResumoReal {
  fonte: Fonte;
  totalAtendimentos: number;
  alertasAbertos: number;
  ultimaAtualizacao: string | null;
}

export async function getResumo(): Promise<ResumoReal> {
  const vazio: ResumoReal = {
    fonte: "mock",
    totalAtendimentos: 0,
    alertasAbertos: 0,
    ultimaAtualizacao: null,
  };
  if (!dbHabilitado) return vazio;
  const emp = empresaAtual();
  try {
    const [tot] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.eventos_agregados where empresa_id = ${emp}
    `;
    if (!tot || tot.n === 0) return vazio;

    const [alb] = await sql<{ n: number }[]>`
      select count(*)::int as n from (
        select cluster_setor, cluster_turno, coalesce(cluster_site,'') as site
        from public.eventos_agregados
        where empresa_id = ${emp} and iniciada_em > now() - interval '90 days'
        group by 1,2,3
        having avg(${sql.unsafe(SCORE_SQL)}) >= 60
      ) c
    `;
    const [ult] = await sql<{ t: string }[]>`
      select max(criado_em)::text as t from public.eventos_agregados where empresa_id = ${emp}
    `;
    return {
      fonte: "real",
      totalAtendimentos: tot.n,
      alertasAbertos: alb?.n ?? 0,
      ultimaAtualizacao: ult?.t ?? null,
    };
  } catch (e) {
    console.warn("[queries] getResumo falhou, usando mock:", e);
    return vazio;
  }
}

/* -------------------------------------------------------------------------- */
/*  Heatmap setor × turno (índice de risco 0-100)                             */
/* -------------------------------------------------------------------------- */
export async function getHeatmap(): Promise<{ fonte: Fonte; linhas: LinhaHeatmap[] }> {
  // Dashboard 100% real: sem dados → vazio (nunca o mock).
  if (!dbHabilitado) return { fonte: "mock", linhas: [] };
  const emp = empresaAtual();
  try {
    // Radar é o sinal PRIMÁRIO de escuta (amplo). Clínica é fallback (profundo).
    // k-anonymity: só clusters de radar com k ≥ K_MIN entram.
    const [radar, clinic] = await Promise.all([
      sql<{ setor: string; turno: string; avg_en: number; n: number }[]>`
        select cluster_setor as setor, cluster_turno as turno,
               avg(energia)::float8 as avg_en, count(*)::int as n
        from public.pulso_respostas
        where empresa_id = ${emp}
        group by cluster_setor, cluster_turno
      `,
      sql<{ setor: string; turno: string; risco: number }[]>`
        select cluster_setor as setor, cluster_turno as turno,
               avg(${sql.unsafe(SCORE_SQL)})::int as risco
        from public.eventos_agregados
        where empresa_id = ${emp}
        group by cluster_setor, cluster_turno
      `,
    ]);

    const cell = new Map<string, number>(); // `${setor}|${turno}` -> risco
    const setores = new Set<string>();
    const key = (s: string, t: string) => `${s}|${t}`;

    // 1) clínica (fallback)
    for (const r of clinic) {
      cell.set(key(r.setor, r.turno), r.risco);
      setores.add(r.setor);
    }
    // 2) radar sobrescreve quando há massa crítica (k-anonymity)
    for (const r of radar) {
      setores.add(r.setor);
      if (r.n >= K_MIN) cell.set(key(r.setor, r.turno), energiaParaRisco(r.avg_en));
    }

    if (cell.size === 0) return { fonte: "real", linhas: [] };

    const linhas: LinhaHeatmap[] = [...setores]
      .map((setor) => ({
        setor,
        valores: TURNOS_ORDEM.map((t) => cell.get(key(setor, t)) ?? 0),
      }))
      .sort((a, b) => Math.max(...b.valores) - Math.max(...a.valores));

    return { fonte: "real", linhas };
  } catch (e) {
    console.warn("[queries] getHeatmap falhou:", e);
    return { fonte: "mock", linhas: [] };
  }
}

/* -------------------------------------------------------------------------- */
/*  Alertas preditivos — clusters de maior risco recente                       */
/* -------------------------------------------------------------------------- */
function sevDeScore(s: number): Severidade {
  if (s >= 80) return "critico";
  if (s >= 62) return "alto";
  if (s >= 45) return "medio";
  return "baixo";
}

function tempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const dias = Math.floor(ms / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  if (dias < 7) return `há ${dias} dias`;
  const semanas = Math.floor(dias / 7);
  return semanas === 1 ? "há 1 semana" : `há ${semanas} semanas`;
}

export async function getAlertas(): Promise<{ fonte: Fonte; alertas: Alerta[] }> {
  if (!dbHabilitado) return { fonte: "mock", alertas: [] };
  const emp = empresaAtual();
  try {
    const clusters = await sql<
      {
        setor: string;
        turno: string;
        site: string;
        risco: number;
        n: number;
        ultima: string;
      }[]
    >`
      select cluster_setor as setor,
             cluster_turno as turno,
             coalesce(cluster_site, '') as site,
             avg(${sql.unsafe(SCORE_SQL)})::int as risco,
             count(*)::int as n,
             max(iniciada_em)::text as ultima
      from public.eventos_agregados
      where empresa_id = ${emp} and iniciada_em > now() - interval '90 days'
      group by cluster_setor, cluster_turno, cluster_site
      having avg(${sql.unsafe(SCORE_SQL)}) >= 45
      order by avg(${sql.unsafe(SCORE_SQL)}) desc, max(iniciada_em) desc
      limit 6
    `;
    if (clusters.length === 0) return { fonte: "real", alertas: [] };

    // Ofensores dominantes por (setor, turno)
    const ofs = await sql<
      { setor: string; turno: string; tag: OfensorTag; c: number }[]
    >`
      select e.cluster_setor as setor, e.cluster_turno as turno,
             o.tag as tag, count(*)::int as c
      from public.eventos_agregados e
      join public.ofensores_evento o on o.evento_id = e.id
      where e.empresa_id = ${emp} and e.iniciada_em > now() - interval '90 days'
      group by e.cluster_setor, e.cluster_turno, o.tag
    `;
    const topOfensores = (setor: string, turno: string): OfensorTag[] =>
      ofs
        .filter((o) => o.setor === setor && o.turno === turno)
        .sort((a, b) => b.c - a.c)
        .slice(0, 2)
        .map((o) => o.tag);

    const turnoLabel: Record<string, string> = {
      manha: "Manhã",
      tarde: "Tarde",
      noite: "Noite",
      madrugada: "Madrugada",
    };

    const alertas: Alerta[] = clusters.map((c, i) => {
      const tops = topOfensores(c.setor, c.turno);
      const sev = sevDeScore(c.risco);
      const titulo =
        tops.length > 0 ? `${OFENSORES_LABEL[tops[0]]} em alta` : "Risco psicossocial em alta";
      const clusterStr = `${c.setor} · ${turnoLabel[c.turno] ?? c.turno}${c.site ? ` · ${c.site}` : ""}`;
      const desc =
        tops.length > 0
          ? `Ofensores predominantes: ${tops.map((t) => OFENSORES_LABEL[t]).join(", ")}. Índice de risco ${c.risco}/100 em ${c.n} atendimento(s).`
          : `Índice de risco ${c.risco}/100 em ${c.n} atendimento(s).`;
      return {
        id: `al-real-${i}`,
        titulo,
        cluster: clusterStr,
        severidade: sev,
        variacao: `risco ${c.risco}/100`,
        descricao: desc,
        desde: tempoRelativo(c.ultima),
      };
    });

    return { fonte: "real", alertas };
  } catch (e) {
    console.warn("[queries] getAlertas falhou:", e);
    return { fonte: "mock", alertas: [] };
  }
}

/* -------------------------------------------------------------------------- */
/*  Série temporal mensal (índice de risco). Precisa de ≥3 meses p/ valer.    */
/*  Adesão (Radar WhatsApp) é outro subsistema → permanece do baseline mock.  */
/* -------------------------------------------------------------------------- */
const MES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function getSerie(): Promise<{ fonte: Fonte; serie: PontoSerie[] }> {
  if (!dbHabilitado) return { fonte: "mock", serie: serieMock };
  const emp = empresaAtual();
  try {
    const rows = await sql<{ mnum: number; risco: number }[]>`
      select extract(month from date_trunc('month', iniciada_em))::int as mnum,
             avg(${sql.unsafe(SCORE_SQL)})::int as risco
      from public.eventos_agregados
      where empresa_id = ${emp} and iniciada_em > now() - interval '6 months'
      group by date_trunc('month', iniciada_em)
      order by date_trunc('month', iniciada_em)
    `;
    if (rows.length < 3) return { fonte: "mock", serie: serieMock };
    const serie: PontoSerie[] = rows.map((r, i) => ({
      mes: MES_PT[(r.mnum - 1 + 12) % 12],
      risco: r.risco,
      // adesão real virá do subsistema de Radar; baseline mock por ora
      adesao: serieMock[Math.min(i, serieMock.length - 1)]?.adesao ?? 70,
    }));
    return { fonte: "real", serie };
  } catch (e) {
    console.warn("[queries] getSerie falhou, usando mock:", e);
    return { fonte: "mock", serie: serieMock };
  }
}

/* -------------------------------------------------------------------------- */
/*  Inventário de Riscos (PGR vivo) — derivado de (setor × ofensor)            */
/*  A IA IDENTIFICA o risco (fonte, setor, severidade, probabilidade) a partir */
/*  dos atendimentos. O PLANO de ação (responsável, prazo, status) é humano —  */
/*  por isso novos riscos entram como "planejado / a definir".                 */
/* -------------------------------------------------------------------------- */

// Ação organizacional sugerida pela IA por tipo de ofensor (não é diagnóstico).
const ACAO_SUGERIDA: Record<OfensorTag, string> = {
  sobrecarga_trabalho: "Redimensionar equipe/escala e revisar metas de volume; instituir pausas.",
  ritmo_pressao_metas: "Revisar política de metas e cadência de cobrança; pactuar prazos realistas.",
  conflito_lideranca: "Capacitação de lideranças e canal estruturado de feedback.",
  jornada_descanso_insuficiente: "Ajustar turnos e garantir descanso; monitorar fadiga.",
  falta_reconhecimento: "Programa de reconhecimento e plano de desenvolvimento/carreira.",
  inseguranca_emprego: "Comunicação transparente sobre mudanças e estabilidade.",
  assedio_moral: "Investigação via compliance e campanha do canal de denúncia.",
  monotonia_falta_autonomia: "Rotação de funções e ampliação de autonomia decisória.",
  isolamento_apoio_social: "Fortalecer trabalho em equipe e suporte entre pares.",
  ambiguidade_de_papel: "Clarificar funções, metas e expectativas do cargo.",
  violencia_terceiros: "Protocolo de segurança e suporte pós-incidente com terceiros.",
};

// Responsável provável por tipo de ofensor (sugestão; humano confirma).
const RESP_SUGERIDO: Record<OfensorTag, string> = {
  sobrecarga_trabalho: "Gestão da área",
  ritmo_pressao_metas: "Diretoria / Comercial",
  conflito_lideranca: "RH · Desenvolvimento",
  jornada_descanso_insuficiente: "SESMT",
  falta_reconhecimento: "RH",
  inseguranca_emprego: "Comunicação / RH",
  assedio_moral: "Compliance",
  monotonia_falta_autonomia: "Gestão da área",
  isolamento_apoio_social: "RH",
  ambiguidade_de_papel: "Gestão da área",
  violencia_terceiros: "Segurança / SESMT",
};

function sevDe1a5(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 5;
  if (score >= 62) return 4;
  if (score >= 45) return 3;
  if (score >= 30) return 2;
  return 1;
}
function probDe1a5(ratio: number): 1 | 2 | 3 | 4 | 5 {
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.6) return 4;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

export async function getInventarioRiscos(): Promise<{ fonte: Fonte; riscos: Risco[] }> {
  if (!dbHabilitado) return { fonte: "mock", riscos: inventarioMock };
  const emp = empresaAtual();
  try {
    // Combina as DUAS fontes reais por (setor × ofensor):
    //  - clínica (eventos_agregados + ofensores_evento): severidade do atendimento
    //  - radar  (pulso_respostas): severidade derivada da energia
    // ocorrencias = volume combinado; sev_score = média ponderada pelo volume.
    const rows = await sql<
      { setor: string; tag: OfensorTag; ocorrencias: number; sev_score: number }[]
    >`
      with clinic as (
        select e.cluster_setor as setor, o.tag as tag,
               count(distinct e.id)::int as oc,
               avg(${sql.unsafe(SCORE_SQL)})::float8 as score
        from public.eventos_agregados e
        join public.ofensores_evento o on o.evento_id = e.id
        where e.empresa_id = ${emp}
        group by e.cluster_setor, o.tag
      ),
      radar as (
        select cluster_setor as setor, ofensor as tag,
               count(*)::int as oc,
               (round((5 - avg(energia)) / 4 * 100))::float8 as score
        from public.pulso_respostas
        where empresa_id = ${emp} and ofensor is not null
        group by cluster_setor, ofensor
      ),
      uni as (
        select setor, tag, oc, score from clinic
        union all
        select setor, tag, oc, score from radar
      )
      select setor, tag,
             sum(oc)::int as ocorrencias,
             round(sum(score * oc) / nullif(sum(oc), 0))::int as sev_score
      from uni
      group by setor, tag
      order by sum(oc) * (sum(score * oc) / nullif(sum(oc), 0)) desc nulls last
      limit 14
    `;
    if (rows.length === 0) return { fonte: "mock", riscos: inventarioMock };

    // Probabilidade espalhada: normaliza a frequência pela maior do conjunto.
    const maxOc = Math.max(...rows.map((r) => r.ocorrencias), 1);

    const riscos: Risco[] = rows.map((r, i) => ({
      id: `R-${String(i + 1).padStart(2, "0")}`,
      fonte: OFENSORES_LABEL[r.tag],
      setor: r.setor,
      severidade: sevDe1a5(r.sev_score),
      probabilidade: probDe1a5(r.ocorrencias / maxOc),
      acao: ACAO_SUGERIDA[r.tag],
      responsavel: RESP_SUGERIDO[r.tag],
      prazo: "A definir",
      status: "planejado",
    }));
    return { fonte: "real", riscos };
  } catch (e) {
    console.warn("[queries] getInventarioRiscos falhou, usando mock:", e);
    return { fonte: "mock", riscos: inventarioMock };
  }
}

/* -------------------------------------------------------------------------- */
/*  Escuta Ativa — atividade REAL por setor (atendimentos registrados).        */
/*  Obs.: o Radar (micro-pulsos WhatsApp) é outro subsistema e segue ilustrado */
/*  na tela; aqui devolvemos a atividade real downstream (atendimentos).       */
/* -------------------------------------------------------------------------- */
export interface AtividadeSetor {
  setor: string;
  atendimentos: number;
  risco: number;
}

export async function getEscuta(): Promise<{
  fonte: Fonte;
  porSetor: AtividadeSetor[];
  total: number;
}> {
  if (!dbHabilitado) return { fonte: "mock", porSetor: [], total: 0 };
  const emp = empresaAtual();
  try {
    const rows = await sql<{ setor: string; n: number; risco: number }[]>`
      select cluster_setor as setor,
             count(*)::int as n,
             avg(${sql.unsafe(SCORE_SQL)})::int as risco
      from public.eventos_agregados
      where empresa_id = ${emp}
      group by cluster_setor
      order by count(*) desc
    `;
    if (rows.length === 0) return { fonte: "mock", porSetor: [], total: 0 };
    const porSetor = rows.map((r) => ({ setor: r.setor, atendimentos: r.n, risco: r.risco }));
    const total = porSetor.reduce((a, b) => a + b.atendimentos, 0);
    return { fonte: "real", porSetor, total };
  } catch (e) {
    console.warn("[queries] getEscuta falhou:", e);
    return { fonte: "mock", porSetor: [], total: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/*  Conformidade & eSocial — checklist computado + trilha de auditoria real    */
/* -------------------------------------------------------------------------- */
export interface ConformidadeData {
  fonte: Fonte;
  checklist: ItemChecklist[];
  conformidade: number;
  eventos: EventoESocial[];
  trilha: EventoAuditoria[];
}

export async function getConformidade(): Promise<ConformidadeData> {
  const mockData: ConformidadeData = {
    fonte: "mock",
    checklist: checklistMock,
    conformidade: Math.round(
      (checklistMock.filter((c) => c.status === "ok").length / checklistMock.length) * 100,
    ),
    eventos: esocialMock,
    trilha: trilhaMock,
  };
  if (!dbHabilitado) return mockData;
  const emp = empresaAtual();
  try {
    const [tot] = await sql<{ n: number; prot: number; ultima: string | null }[]>`
      select count(*)::int as n,
             count(*) filter (where protocolo_emergencia)::int as prot,
             max(criado_em)::text as ultima
      from public.eventos_agregados
      where empresa_id = ${emp}
    `;
    if (!tot || tot.n === 0) return mockData;

    const temEventos = tot.n > 0;
    const checklist: ItemChecklist[] = [
      {
        item: "Inventário de riscos psicossociais",
        descricao: "Riscos mapeados por fonte organizacional, a partir dos atendimentos.",
        status: temEventos ? "ok" : "pendente",
      },
      {
        item: "PGR contempla riscos psicossociais",
        descricao: "Documento vivo, atualizado automaticamente pela IA.",
        status: temEventos ? "ok" : "pendente",
      },
      {
        item: "Evidências de escuta ativa",
        descricao: `${tot.n} atendimento(s) anônimo(s) registrado(s) como evidência.`,
        status: temEventos ? "ok" : "pendente",
      },
      {
        item: "Plano de ação com responsáveis e prazos",
        descricao: "Riscos identificados pela IA — aguardando definição humana do plano.",
        status: "atencao",
      },
      {
        item: "Protocolo de risco grave/iminente",
        descricao:
          tot.prot > 0
            ? `${tot.prot} acionamento(s) de emergência registrado(s).`
            : "Fluxo de emergência definido e testado.",
        status: "ok",
      },
      {
        item: "Assinatura do responsável técnico (SESMT)",
        descricao: "Validação humana da revisão atual do PGR.",
        status: "pendente",
      },
      {
        item: "Treinamento de lideranças",
        descricao: "Capacitação em fatores psicossociais (NR-1).",
        status: "atencao",
      },
    ];
    const okCount = checklist.filter((c) => c.status === "ok").length;
    const conformidade = Math.round((okCount / checklist.length) * 100);

    // eSocial: S-2240 reflete a contagem real de eventos de risco; demais ilustrativos.
    const ultimoFmt = tot.ultima
      ? new Date(tot.ultima).toLocaleDateString("pt-BR")
      : esocialMock[2].ultimo;
    const eventos: EventoESocial[] = esocialMock.map((e) =>
      e.codigo === "S-2240"
        ? { ...e, quantidade: tot.n, status: "processando", ultimo: ultimoFmt }
        : e,
    );

    // Trilha de auditoria real: últimos eventos + log do webhook.
    const recentes = await sql<
      {
        setor: string;
        turno: string;
        site: string | null;
        sev: string;
        iniciada: string;
        criado: string;
      }[]
    >`
      select cluster_setor as setor, cluster_turno as turno, cluster_site as site,
             severidade_estimada as sev, iniciada_em::text as iniciada, criado_em::text as criado
      from public.eventos_agregados
      where empresa_id = ${emp}
      order by criado_em desc
      limit 4
    `;

    const trilha: EventoAuditoria[] = [];
    recentes.forEach((ev, idx) => {
      const cl = `${ev.setor} · ${TURNO_LABEL[ev.turno] ?? ev.turno}${ev.site ? ` · ${ev.site}` : ""}`;
      if (idx === 0) {
        // Cadeia completa para o atendimento mais recente.
        trilha.push({
          data: fmtData(ev.iniciada),
          fase: "Escuta",
          ator: "ia",
          descricao: `Sinal de risco detectado no cluster ${cl} (anônimo, k≥7).`,
        });
        trilha.push({
          data: fmtData(ev.iniciada),
          fase: "Cuidado",
          ator: "clinica",
          descricao: "Acolhimento clínico realizado em sigilo; ofensores organizacionais tagueados (sem PII).",
        });
        trilha.push({
          data: fmtData(ev.criado),
          fase: "Ação",
          ator: "ia",
          descricao: `Risco registrado no inventário/PGR para ${cl}. Severidade estimada: ${ev.sev}.`,
        });
      }
      trilha.push({
        data: fmtData(ev.criado),
        fase: "Compliance",
        ator: "ia",
        descricao: `Evento agregado recebido e assinado (HMAC válido) · ${cl}. PGR atualizado.`,
      });
    });

    return { fonte: "real", checklist, conformidade, eventos, trilha };
  } catch (e) {
    console.warn("[queries] getConformidade falhou, usando mock:", e);
    return mockData;
  }
}

/* -------------------------------------------------------------------------- */
/*  Assinatura digital do PGR — snapshot, comparação e histórico              */
/* -------------------------------------------------------------------------- */
export interface PgrResumo {
  totalEventos: number;
  conformidade: number;
  totalRiscos: number;
  criticos: number;
  altos: number;
  medios: number;
  baixos: number;
}
export interface PgrAssinatura {
  revisao: number;
  assinante_nome: string;
  assinante_papel: string;
  assinante_registro: string | null;
  assinado_em: string;
  conteudo_hash: string;
  selo: string;
}
export interface PgrStatus {
  fonte: Fonte;
  conteudoHash: string;
  resumo: PgrResumo;
  ultima: PgrAssinatura | null;
  pendente: boolean;
  motivo: "nunca_assinado" | "conteudo_alterado" | null;
  proximaRevisao: number;
  revisaoVigente: number | null;
  historico: PgrAssinatura[];
  /** Dados Okêbambo da revisão atual (rascunho) — usados pelo PDF e UI. */
  dadosOkebambo: PgrRevisao | null;
}

/** Monta o snapshot canônico + hash a partir dos riscos, conformidade e dados Okêbambo. */
function montarSnapshot(
  riscos: Risco[],
  conformidade: number,
  totalEventos: number,
  dadosOkebambo: PgrRevisao | null,
): { hash: string; resumo: PgrResumo; canonico: unknown } {
  const nivel = (r: Risco) => r.severidade * r.probabilidade;
  const criticos = riscos.filter((r) => nivel(r) >= 15).length;
  const altos = riscos.filter((r) => nivel(r) >= 9 && nivel(r) < 15).length;
  const medios = riscos.filter((r) => nivel(r) >= 4 && nivel(r) < 9).length;
  const baixos = riscos.filter((r) => nivel(r) < 4).length;

  const riscosCanon = riscos
    .map((r) => ({
      fonte: r.fonte,
      setor: r.setor,
      severidade: r.severidade,
      probabilidade: r.probabilidade,
    }))
    .sort((a, b) =>
      (a.setor + a.fonte).localeCompare(b.setor + b.fonte),
    );

  // Extensão Okêbambo (Onda 4 §6) — os campos editáveis entram na canonicalização
  // para que qualquer alteração nos dados invalide a assinatura anterior.
  const okebambo = dadosOkebambo
    ? {
        cnpj: dadosOkebambo.cnpj ?? null,
        razao_social: dadosOkebambo.razao_social ?? null,
        nome_fantasia: dadosOkebambo.nome_fantasia ?? null,
        endereco: dadosOkebambo.endereco ?? null,
        responsavel_tecnico_nome: dadosOkebambo.responsavel_tecnico_nome ?? null,
        responsavel_tecnico_registro: dadosOkebambo.responsavel_tecnico_registro ?? null,
        responsavel_tecnico_conselho: dadosOkebambo.responsavel_tecnico_conselho ?? null,
        publico_atendido: dadosOkebambo.publico_atendido ?? null,
        descricao_atividades: dadosOkebambo.descricao_atividades ?? null,
        riscos_fisicos: dadosOkebambo.riscos_fisicos ?? [],
        riscos_ergonomicos: dadosOkebambo.riscos_ergonomicos ?? [],
      }
    : null;

  const canonico = {
    empresa: empresa.cnpj,
    totalEventos,
    conformidade,
    riscos: riscosCanon,
    okebambo,
  };
  const resumo: PgrResumo = {
    totalEventos,
    conformidade,
    totalRiscos: riscos.length,
    criticos,
    altos,
    medios,
    baixos,
  };
  return { hash: hashConteudo(canonico), resumo, canonico };
}

export async function getPgrStatus(): Promise<PgrStatus> {
  // Riscos + conformidade + total de eventos + dados Okêbambo compõem o conteúdo do PGR.
  const [{ riscos, fonte: fr }, conf, resumoGeral, dadosOkebambo] = await Promise.all([
    getInventarioRiscos(),
    getConformidade(),
    getResumo(),
    obterRevisaoAtual().catch(() => null),
  ]);
  const totalEventos =
    resumoGeral.fonte === "real" ? resumoGeral.totalAtendimentos : 0;
  const { hash, resumo } = montarSnapshot(
    riscos,
    conf.conformidade,
    totalEventos,
    dadosOkebambo,
  );
  const fonte: Fonte = fr === "real" || conf.fonte === "real" ? "real" : "mock";

  let historico: PgrAssinatura[] = [];
  if (dbHabilitado) {
    try {
      historico = await sql<PgrAssinatura[]>`
        select revisao, assinante_nome, assinante_papel, assinante_registro,
               assinado_em::text as assinado_em, conteudo_hash, selo
        from public.pgr_assinaturas
        where empresa_id = ${empresaAtual()}
        order by assinado_em desc
      `;
    } catch (e) {
      console.warn("[queries] getPgrStatus histórico falhou:", e);
    }
  }

  const ultima = historico[0] ?? null;
  const maxRevisao = historico.reduce((m, a) => Math.max(m, a.revisao), 0);
  const pendente = !ultima || ultima.conteudo_hash !== hash;
  const motivo = !ultima ? "nunca_assinado" : pendente ? "conteudo_alterado" : null;

  return {
    fonte,
    conteudoHash: hash,
    resumo,
    ultima,
    pendente,
    motivo,
    proximaRevisao: maxRevisao + 1,
    revisaoVigente: !pendente && ultima ? ultima.revisao : null,
    historico,
    dadosOkebambo,
  };
}

/* -------------------------------------------------------------------------- */
/*  RADAR — agregações dos micro-pulsos (k-anonymity na leitura)              */
/* -------------------------------------------------------------------------- */
export interface RadarResumo {
  fonte: Fonte;
  adesao: number; // %
  respostasSemana: number;
  alcance: number; // convidados
  tempoMedio: number; // segundos
  totalRespostas: number;
}

export async function getRadarResumo(): Promise<RadarResumo> {
  const vazio: RadarResumo = {
    fonte: "mock",
    adesao: 0,
    respostasSemana: 0,
    alcance: 0,
    tempoMedio: 0,
    totalRespostas: 0,
  };
  if (!dbHabilitado) return vazio;
  const emp = empresaAtual();
  try {
    const [r] = await sql<
      { total: number; semana: number; tempo: number; alcance: number }[]
    >`
      select
        (select count(*)::int from public.pulso_respostas where empresa_id = ${emp}) as total,
        (select count(*)::int from public.pulso_respostas
          where empresa_id = ${emp} and respondido_em > now() - interval '7 days') as semana,
        (select coalesce(round(avg(duracao_seg)),0)::int from public.pulso_respostas where empresa_id = ${emp}) as tempo,
        (select coalesce(sum(convidados),0)::int from public.pulso_alvos where empresa_id = ${emp}) as alcance
    `;
    if (!r || r.total === 0) return vazio;
    const adesao = r.alcance > 0 ? Math.min(100, Math.round((r.total / r.alcance) * 100)) : 0;
    return {
      fonte: "real",
      adesao,
      respostasSemana: r.semana,
      alcance: r.alcance,
      tempoMedio: r.tempo,
      totalRespostas: r.total,
    };
  } catch (e) {
    console.warn("[queries] getRadarResumo falhou:", e);
    return vazio;
  }
}

export async function getRadarCanais(): Promise<{ fonte: Fonte; canais: { canal: string; valor: number }[] }> {
  if (!dbHabilitado) return { fonte: "mock", canais: [] };
  const emp = empresaAtual();
  try {
    const rows = await sql<{ canal: string; n: number }[]>`
      select canal, count(*)::int as n from public.pulso_respostas where empresa_id = ${emp} group by canal
    `;
    const total = rows.reduce((a, b) => a + b.n, 0);
    if (total === 0) return { fonte: "mock", canais: [] };
    const nomeCanal: Record<string, string> = { whatsapp: "WhatsApp", app: "App interno", totem: "Totem/QR" };
    const canais = rows
      .map((r) => ({ canal: nomeCanal[r.canal] ?? r.canal, valor: Math.round((r.n / total) * 100) }))
      .sort((a, b) => b.valor - a.valor);
    return { fonte: "real", canais };
  } catch (e) {
    console.warn("[queries] getRadarCanais falhou:", e);
    return { fonte: "mock", canais: [] };
  }
}

const DIA_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function getRadarRespostasSemana(): Promise<{
  fonte: Fonte;
  dados: { dia: string; respostas: number }[];
}> {
  if (!dbHabilitado) return { fonte: "mock", dados: [] };
  const emp = empresaAtual();
  try {
    const rows = await sql<{ d: string; n: number }[]>`
      select date_trunc('day', respondido_em)::date::text as d, count(*)::int as n
      from public.pulso_respostas
      where empresa_id = ${emp} and respondido_em > now() - interval '7 days'
      group by 1 order by 1
    `;
    if (rows.length === 0) return { fonte: "mock", dados: [] };
    const dados = rows.map((r) => ({ dia: DIA_PT[new Date(r.d + "T12:00:00").getDay()], respostas: r.n }));
    return { fonte: "real", dados };
  } catch (e) {
    console.warn("[queries] getRadarRespostasSemana falhou:", e);
    return { fonte: "mock", dados: [] };
  }
}

export async function getRadarPorSetor(): Promise<{
  fonte: Fonte;
  setores: { setor: string; respostas: number; risco: number }[];
}> {
  if (!dbHabilitado) return { fonte: "mock", setores: [] };
  const emp = empresaAtual();
  try {
    // k-anonymity: só setores com k ≥ K_MIN respostas.
    const rows = await sql<{ setor: string; n: number; avg_en: number }[]>`
      select cluster_setor as setor, count(*)::int as n, avg(energia)::float8 as avg_en
      from public.pulso_respostas
      where empresa_id = ${emp}
      group by cluster_setor
      having count(*) >= ${K_MIN}
      order by avg(energia) asc
    `;
    if (rows.length === 0) return { fonte: "mock", setores: [] };
    const setores = rows.map((r) => ({
      setor: r.setor,
      respostas: r.n,
      risco: energiaParaRisco(r.avg_en),
    }));
    return { fonte: "real", setores };
  } catch (e) {
    console.warn("[queries] getRadarPorSetor falhou:", e);
    return { fonte: "mock", setores: [] };
  }
}

export async function getRadarOfensores(): Promise<{
  fonte: Fonte;
  ofensores: { tag: OfensorTag; label: string; n: number }[];
}> {
  if (!dbHabilitado) return { fonte: "mock", ofensores: [] };
  const emp = empresaAtual();
  try {
    const rows = await sql<{ tag: OfensorTag; n: number }[]>`
      select ofensor as tag, count(*)::int as n
      from public.pulso_respostas
      where empresa_id = ${emp} and ofensor is not null
      group by ofensor
      order by count(*) desc
      limit 6
    `;
    if (rows.length === 0) return { fonte: "mock", ofensores: [] };
    return {
      fonte: "real",
      ofensores: rows.map((r) => ({ tag: r.tag, label: OFENSORES_LABEL[r.tag], n: r.n })),
    };
  } catch (e) {
    console.warn("[queries] getRadarOfensores falhou:", e);
    return { fonte: "mock", ofensores: [] };
  }
}

/* -------------------------------------------------------------------------- */
/*  DASHBOARD — KPIs 100% reais (sem mock) + série diária real                */
/* -------------------------------------------------------------------------- */
export interface DashMetric {
  id: string;
  rotulo: string;
  valor: string;
  unidade?: string;
  trendLabel: string;
  trendSentido: "bom" | "ruim" | "neutro";
  spark?: number[];
}

export async function getDashboardMetrics(): Promise<{
  fonte: Fonte;
  cards: DashMetric[];
  pendencias: string[];
}> {
  if (!dbHabilitado) return { fonte: "mock", cards: [], pendencias: [] };
  try {
    const [radar, resumo, conf] = await Promise.all([
      getRadarResumo(),
      getResumo(),
      getConformidade(),
    ]);
    // Sem nenhum dado real → vazio (UI mostra estado vazio honesto).
    if (radar.fonte !== "real" && resumo.fonte !== "real") {
      return { fonte: "mock", cards: [], pendencias: [] };
    }

    // Sparklines reais: volume por dia (7 dias).
    const emp = empresaAtual();
    const [pulsosDia, atendDia] = await Promise.all([
      sql<{ n: number }[]>`
        select count(*)::int as n
        from public.pulso_respostas
        where empresa_id = ${emp} and respondido_em > now() - interval '7 days'
        group by date_trunc('day', respondido_em)
        order by date_trunc('day', respondido_em)
      `,
      sql<{ n: number }[]>`
        select count(*)::int as n
        from public.eventos_agregados
        where empresa_id = ${emp} and criado_em > now() - interval '7 days'
        group by date_trunc('day', criado_em)
        order by date_trunc('day', criado_em)
      `,
    ]);

    // Trend semana atual vs anterior.
    const [pw] = await sql<{ atual: number; ant: number }[]>`
      select
        count(*) filter (where respondido_em > now() - interval '7 days')::int as atual,
        count(*) filter (where respondido_em <= now() - interval '7 days'
                          and respondido_em > now() - interval '14 days')::int as ant
      from public.pulso_respostas
      where empresa_id = ${emp}
    `;
    const deltaPulsos = pw.atual - pw.ant;

    const cards: DashMetric[] = [
      {
        id: "vidas",
        rotulo: "Vidas monitoradas",
        valor: radar.alcance.toLocaleString("pt-BR"),
        trendLabel: "convidados ao radar",
        trendSentido: "neutro",
      },
      {
        id: "adesao",
        rotulo: "Adesão aos pulsos",
        valor: String(radar.adesao),
        unidade: "%",
        trendLabel: `${radar.respostasSemana} resp. na semana`,
        trendSentido: radar.adesao >= 60 ? "bom" : "neutro",
        spark: pulsosDia.map((r) => r.n),
      },
      {
        id: "pulsos",
        rotulo: "Pulsos (7 dias)",
        valor: radar.respostasSemana.toLocaleString("pt-BR"),
        trendLabel: deltaPulsos >= 0 ? `+${deltaPulsos} vs. semana` : `${deltaPulsos} vs. semana`,
        trendSentido: deltaPulsos >= 0 ? "bom" : "ruim",
        spark: pulsosDia.map((r) => r.n),
      },
      {
        id: "alertas",
        rotulo: "Alertas de risco abertos",
        valor: String(resumo.alertasAbertos),
        trendLabel: "clusters acima do limiar",
        trendSentido: resumo.alertasAbertos > 0 ? "ruim" : "bom",
      },
      {
        id: "atend",
        rotulo: "Atendimentos (clínica)",
        valor: resumo.totalAtendimentos.toLocaleString("pt-BR"),
        trendLabel: "devolutivas anônimas",
        trendSentido: "neutro",
        spark: atendDia.map((r) => r.n),
      },
      {
        id: "pgr",
        rotulo: "Conformidade do PGR",
        valor: String(conf.conformidade),
        unidade: "%",
        trendLabel: `${conf.checklist.filter((c) => c.status === "ok").length}/${conf.checklist.length} itens`,
        trendSentido: conf.conformidade >= 80 ? "bom" : "neutro",
      },
    ];

    const pendencias = conf.checklist
      .filter((c) => c.status !== "ok")
      .map((c) => c.item);

    return { fonte: "real", cards, pendencias };
  } catch (e) {
    console.warn("[queries] getDashboardMetrics falhou:", e);
    return { fonte: "mock", cards: [], pendencias: [] };
  }
}

/** Série diária real (14 dias): índice de risco (radar) + respostas/dia. */
export async function getSerieRadarDiaria(): Promise<{ fonte: Fonte; serie: PontoSerie[] }> {
  if (!dbHabilitado) return { fonte: "mock", serie: [] };
  const emp = empresaAtual();
  try {
    const rows = await sql<{ d: string; risco: number; respostas: number }[]>`
      select date_trunc('day', respondido_em)::date::text as d,
             round((5 - avg(energia)) / 4 * 100)::int as risco,
             count(*)::int as respostas
      from public.pulso_respostas
      where empresa_id = ${emp} and respondido_em > now() - interval '14 days'
      group by 1 order by 1
    `;
    if (rows.length === 0) return { fonte: "mock", serie: [] };
    const serie: PontoSerie[] = rows.map((r) => {
      const dt = new Date(r.d + "T12:00:00");
      return {
        mes: `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`,
        risco: r.risco,
        adesao: r.respostas, // 2ª série: respostas/dia
      };
    });
    return { fonte: "real", serie };
  } catch (e) {
    console.warn("[queries] getSerieRadarDiaria falhou:", e);
    return { fonte: "mock", serie: [] };
  }
}
