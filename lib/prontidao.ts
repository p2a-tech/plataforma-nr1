import "server-only";
import { sql } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";
import { resumoAdesao } from "@/lib/drps";
import { resumoExecutivo } from "@/lib/drps-analise";
import { getPgrStatus } from "@/lib/queries";
import { contarPorSetor } from "@/lib/colaboradores";
import { listarEventosAtivos } from "@/lib/risco-grave";

/**
 * Prontidão para auditoria NR-1 (Onda 9 · Dev B).
 *
 * Consolida o estado de conformidade da empresa num único placar — a resposta
 * para "estou pronto pra uma fiscalização do MPT/AFT?". NÃO recalcula nada:
 * cada item REUSA a lib de origem (DRPS, análise setorizada, PGR, risco grave,
 * colaboradores, governança). Aqui só normalizamos status (ok/atenção/pendente)
 * e derivamos o score agregado.
 *
 * Tudo tenant-scoped: `avaliarProntidao` roda dentro de `withEmpresa` para que
 * as libs que dependem de `empresaAtual()` (getPgrStatus, getConformidade)
 * enxerguem o escopo correto. RLS no banco é a defesa em profundidade.
 *
 * score = round(100 * (ok + 0.5*atenção) / total_de_itens).
 *   <60  → "Em risco" · 60-84 → "Em progresso" · ≥85 → "Pronto".
 */

export type StatusProntidao = "ok" | "atencao" | "pendente";

export interface ItemProntidao {
  chave: string;
  rotulo: string;
  status: StatusProntidao;
  detalhe: string;
  href: string;
}

export interface Prontidao {
  score: number; // 0..100
  itens: ItemProntidao[];
}

/** Amostra DRPS mínima para uma análise setorizada com k-anonimato (k≥7). */
const AMOSTRA_DRPS_RAZOAVEL = 7;

/**
 * Conta planos de ação direto na tabela (sem acoplar à lib do Dev A).
 * Lê DENTRO de um escopo `withEmpresa` já aberto pelo caller — RLS garante
 * o isolamento por empresa. `vencidos` = pendente|em_andamento com prazo no
 * passado; `ativos` = pendente|em_andamento (independente de prazo).
 */
async function contarPlanos(empresaId: string): Promise<{
  total: number;
  ativos: number;
  vencidos: number;
}> {
  const [row] = await sql<
    { total: number; ativos: number; vencidos: number }[]
  >`
    select
      count(*)::int as total,
      count(*) filter (where status in ('pendente','em_andamento'))::int as ativos,
      count(*) filter (
        where status in ('pendente','em_andamento')
          and prazo is not null
          and prazo < current_date
      )::int as vencidos
    from public.plano_acao
    where empresa_id = ${empresaId}
  `;
  return {
    total: row?.total ?? 0,
    ativos: row?.ativos ?? 0,
    vencidos: row?.vencidos ?? 0,
  };
}

/** True se há ao menos um risco alto mapeado na análise setorizada. */
function temRiscoAlto(
  resumo: Awaited<ReturnType<typeof resumoExecutivo>>,
): boolean {
  return resumo.n_setores_alto > 0;
}

/**
 * Avalia a prontidão de uma empresa para fiscalização NR-1.
 * Abre o escopo de empresa internamente (idempotente se já estiver aberto —
 * `withEmpresa` reentra com segurança), então pode ser chamada direto da page.
 */
export async function avaliarProntidao(empresaId: string): Promise<Prontidao> {
  return withEmpresa(empresaId, async () => {
    // Coleta em paralelo. Cada chamada é tolerante a falha — um item que não
    // pôde ser avaliado vira "pendente" com detalhe genérico, nunca quebra a
    // tela inteira (banco vazio é o caso normal em produção recém-provisionada).
    const [adesao, resumo, pgr, planos, colaboradores, eventosGraves, lgpdOk] =
      await Promise.all([
        resumoAdesao(empresaId).catch(() => null),
        resumoExecutivo(empresaId).catch(() => null),
        getPgrStatus().catch(() => null),
        contarPlanos(empresaId).catch(() => ({ total: 0, ativos: 0, vencidos: 0 })),
        contarPorSetor(empresaId).catch(() => [] as { setor: string; total: number }[]),
        listarEventosAtivos(empresaId).catch(() => []),
        lgpdConfigurada().catch(() => false),
      ]);

    const itens: ItemProntidao[] = [];

    /* 1) DRPS aplicado no ciclo atual ------------------------------------- */
    const totalRespostas = adesao?.total ?? 0;
    itens.push({
      chave: "drps_aplicado",
      rotulo: "DRPS aplicado",
      href: "/escuta/drps",
      ...(totalRespostas === 0
        ? {
            status: "pendente" as const,
            detalhe:
              "Nenhuma resposta coletada. Aplique o diagnóstico de riscos psicossociais para iniciar a evidência de escuta.",
          }
        : totalRespostas < AMOSTRA_DRPS_RAZOAVEL
          ? {
              status: "atencao" as const,
              detalhe: `Apenas ${totalRespostas} resposta(s) — amostra abaixo do k-anonimato (k≥${AMOSTRA_DRPS_RAZOAVEL}). Amplie a adesão para uma análise setorizada válida.`,
            }
          : {
              status: "ok" as const,
              detalhe: `${totalRespostas} respostas coletadas — amostra suficiente para análise setorizada.`,
            }),
    });

    /* 2) Risco mapeado ----------------------------------------------------- */
    const temClassificacao =
      resumo != null && resumo.media_geral != null;
    itens.push({
      chave: "risco_mapeado",
      rotulo: "Risco psicossocial mapeado",
      href: "/riscos",
      ...(temClassificacao
        ? {
            status: "ok" as const,
            detalhe: `Média geral ${resumo!.media_geral} em ${resumo!.n_setores} setor(es); ${resumo!.n_setores_alto} com risco alto.`,
          }
        : {
            status: "pendente" as const,
            detalhe:
              "Sem classificação de risco. É preciso amostra DRPS válida (k≥7) por setor para mapear o risco psicossocial.",
          }),
    });

    /* 3) PGR assinado e vigente ------------------------------------------- */
    if (pgr == null) {
      itens.push({
        chave: "pgr_assinado",
        rotulo: "PGR assinado e vigente",
        href: "/pgr",
        status: "pendente",
        detalhe: "Não foi possível avaliar o PGR. Verifique a configuração do banco.",
      });
    } else if (!pgr.pendente && pgr.ultima) {
      itens.push({
        chave: "pgr_assinado",
        rotulo: "PGR assinado e vigente",
        href: "/pgr",
        status: "ok",
        detalhe: `Assinado por ${pgr.ultima.assinante_nome} (rev ${pgr.ultima.revisao}). Hash do conteúdo confere.`,
      });
    } else if (pgr.motivo === "conteudo_alterado") {
      itens.push({
        chave: "pgr_assinado",
        rotulo: "PGR assinado e vigente",
        href: "/pgr",
        status: "atencao",
        detalhe: `Conteúdo alterado desde a última assinatura — assine a revisão ${pgr.proximaRevisao} para manter a vigência.`,
      });
    } else {
      itens.push({
        chave: "pgr_assinado",
        rotulo: "PGR assinado e vigente",
        href: "/pgr",
        status: "pendente",
        detalhe:
          "PGR nunca assinado. A assinatura do responsável técnico (SESMT) é obrigatória para a vigência.",
      });
    }

    /* 4) Plano de ação em dia --------------------------------------------- */
    const riscoAlto = resumo != null && temRiscoAlto(resumo);
    if (planos.total === 0) {
      itens.push({
        chave: "plano_acao",
        rotulo: "Plano de ação em dia",
        href: "/conformidade/acoes",
        status: riscoAlto ? "pendente" : "atencao",
        detalhe: riscoAlto
          ? "Há risco alto mapeado e nenhum plano de ação cadastrado. Crie planos interventivos com responsável e prazo."
          : "Nenhum plano de ação cadastrado. Defina ações com responsável e prazo para os fatores priorizados.",
      });
    } else if (planos.vencidos > 0) {
      itens.push({
        chave: "plano_acao",
        rotulo: "Plano de ação em dia",
        href: "/conformidade/acoes",
        status: "atencao",
        detalhe: `${planos.vencidos} plano(s) com prazo vencido de ${planos.ativos} em andamento. Reavalie prazos e responsáveis.`,
      });
    } else {
      itens.push({
        chave: "plano_acao",
        rotulo: "Plano de ação em dia",
        href: "/conformidade/acoes",
        status: "ok",
        detalhe: `${planos.total} plano(s) cadastrado(s), nenhum vencido${planos.ativos > 0 ? ` (${planos.ativos} em andamento)` : ""}.`,
      });
    }

    /* 5) eSocial S-2240 disponível ---------------------------------------- */
    const totalColaboradores = colaboradores.reduce((a, b) => a + b.total, 0);
    const temInventarioRisco = resumo != null && resumo.n_total > 0;
    itens.push({
      chave: "esocial_s2240",
      rotulo: "eSocial S-2240 exportável",
      href: "/conformidade",
      ...(totalColaboradores > 0
        ? {
            status: "ok" as const,
            detalhe: `${totalColaboradores} colaborador(es) ativo(s) — exportação por CPF disponível (evtExpRisco por trabalhador).`,
          }
        : temInventarioRisco
          ? {
              status: "atencao" as const,
              detalhe:
                "Sem colaboradores cadastrados: o S-2240 cai no modo agregado. Cadastre o quadro para o fan-out por CPF.",
            }
          : {
              status: "pendente" as const,
              detalhe:
                "Sem inventário nem colaboradores para exportar. Cadastre o quadro e mapeie os riscos para gerar o S-2240.",
            }),
    });

    /* 6) Risco grave em aberto -------------------------------------------- */
    if (eventosGraves.length > 0) {
      const abertos = eventosGraves.filter((e) => e.status === "aberto").length;
      itens.push({
        chave: "risco_grave_aberto",
        rotulo: "Eventos de risco grave",
        href: "/escuta/risco-grave",
        status: "atencao",
        detalhe: `${eventosGraves.length} evento(s) ativo(s)${abertos > 0 ? ` (${abertos} aberto[s])` : ""}. Acompanhe e encerre o protocolo de emergência.`,
      });
    } else {
      itens.push({
        chave: "risco_grave_aberto",
        rotulo: "Eventos de risco grave",
        href: "/escuta/risco-grave",
        status: "ok",
        detalhe: "Nenhum evento de risco grave/iminente em aberto.",
      });
    }

    /* 7) Governança / consentimento LGPD ---------------------------------- */
    itens.push({
      chave: "lgpd_governanca",
      rotulo: "Governança & consentimento LGPD",
      href: "/governanca",
      ...(lgpdOk
        ? {
            status: "ok" as const,
            detalhe:
              "Controles críticos de privacidade ativos (k-anonimato, consentimento, sigilo clínico, protocolo de risco grave).",
          }
        : {
            status: "atencao" as const,
            detalhe:
              "Há controle crítico de privacidade desativado. Revise a governança LGPD antes da fiscalização.",
          }),
    });

    return { score: calcularScore(itens), itens };
  });
}

/**
 * Lê a config de governança (tabela GLOBAL — sem empresa_id) e verifica se
 * todos os controles `critico=true` estão `ativo=true`. Sem banco/erro → trata
 * como não configurada (atenção). Lida com a tabela ausente devolvendo false.
 */
async function lgpdConfigurada(): Promise<boolean> {
  const rows = await sql<{ ativo: boolean; critico: boolean }[]>`
    select ativo, critico from public.config_governanca where critico = true
  `;
  if (rows.length === 0) return false;
  return rows.every((r) => r.ativo);
}

/** score = round(100 * (ok + 0.5*atenção) / total). Lista vazia → 0. */
export function calcularScore(itens: ItemProntidao[]): number {
  const total = itens.length;
  if (total === 0) return 0;
  const ok = itens.filter((i) => i.status === "ok").length;
  const atencao = itens.filter((i) => i.status === "atencao").length;
  return Math.round((100 * (ok + 0.5 * atencao)) / total);
}

/** Rótulo do nível de prontidão a partir do score. */
export function rotuloProntidao(score: number): {
  rotulo: string;
  tone: "alerta" | "ambar" | "ok";
} {
  if (score >= 85) return { rotulo: "Pronto", tone: "ok" };
  if (score >= 60) return { rotulo: "Em progresso", tone: "ambar" };
  return { rotulo: "Em risco", tone: "alerta" };
}
