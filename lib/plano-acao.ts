import "server-only";
import { sql } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";
import type { Classificacao } from "@/lib/drps-escoragem";

/**
 * Plano de Ação · Onda 4 · §5 do BACKLOG_OKEBAMBO.
 *
 * Dois tipos:
 *   - **Prevencionista**: para riscos baixo|moderado. Ações operacionais
 *     (intervalos, treinamentos, ambiente).
 *   - **Interventivo**: para riscos alto. Encaminhamento clínico, CIPA+DPO,
 *     protocolo de risco grave.
 *
 * Catálogo (`acao_recomendada`) é GLOBAL — todo tenant lê o mesmo. Plano
 * instanciado (`plano_acao`) é multi-tenant via RLS forced.
 */

export type Programa = "prevencionista" | "interventivo";
export type StatusPlano = "pendente" | "em_andamento" | "concluido" | "cancelado";

export interface AcaoRecomendada {
  id: string;
  programa: Programa;
  dim_id: string | null;
  fator_id: string | null;
  titulo: string;
  como_realizar: string;
  responsavel_padrao: string | null;
}

export interface PlanoAcao {
  id: string;
  empresa_id: string;
  fator_id: string;
  classificacao: Classificacao;
  programa: Programa;
  acao_id: string | null;
  titulo_custom: string | null;
  como_realizar_custom: string | null;
  responsavel: string;
  prazo: string | null;
  status: StatusPlano;
  criado_em: string;
  criado_por: string;
  atualizado_em: string | null;
}

export interface PlanoAcaoEnriquecido extends PlanoAcao {
  /** Vem do catálogo, quando há acao_id. */
  acao_titulo: string | null;
  acao_como_realizar: string | null;
  /** Título efetivo: custom > catálogo. */
  titulo_efetivo: string;
  /** Como realizar efetivo: custom > catálogo. */
  como_realizar_efetivo: string;
  /** Nome humano do fator (vem de fator_nr1). */
  fator_nome: string | null;
  /** Dimensão do fator. */
  dim_id: string | null;
  dim_nome: string | null;
}

/**
 * Mapeia a classificação para o programa (regra simples do §5).
 *   alto → interventivo · baixo|moderado → prevencionista.
 */
export function programaPara(classificacao: Classificacao): Programa {
  return classificacao === "alto" ? "interventivo" : "prevencionista";
}

/**
 * Sugere ações do catálogo para um fator+classificação:
 *   1. Filtra pelo programa adequado.
 *   2. Prefere ações com `fator_id` casado; depois `dim_id` da dimensão do fator;
 *      por fim ações transversais (dim_id e fator_id NULL).
 *   3. Ordem: especificidade decrescente, título asc.
 *
 * Fail-safe: se as tabelas do Dev A (fator_nr1) ou do catálogo
 * (acao_recomendada) ainda não estiverem disponíveis, retorna [].
 */
export async function sugerirPlano(
  empresaId: string,
  fatorId: string,
  classificacao: Classificacao,
): Promise<AcaoRecomendada[]> {
  const programa = programaPara(classificacao);
  return withEmpresa(empresaId, async () => {
    // Resolve a dimensão do fator (catálogo global — sem RLS).
    const dimRows = await sql<{ dim_id: string | null }[]>`
      select dim_id from public.fator_nr1 where id = ${fatorId} limit 1
    `;
    const dimId = dimRows[0]?.dim_id ?? null;

    const acoes = await sql<AcaoRecomendada[]>`
      select id, programa, dim_id, fator_id, titulo, como_realizar, responsavel_padrao
        from public.acao_recomendada
       where programa = ${programa}
         and (
           fator_id = ${fatorId}
           or (fator_id is null and (dim_id is null or dim_id = ${dimId}))
         )
       order by
         (fator_id = ${fatorId})::int desc,
         (dim_id = ${dimId})::int desc,
         titulo asc
    `;
    return acoes;
  });
}

export interface FiltrosPlano {
  status?: StatusPlano[];
  fator_id?: string;
  programa?: Programa;
}

/**
 * Lista planos da empresa (cards), enriquecidos com nome do fator e da ação
 * do catálogo (se houver).
 */
export async function listarPlanos(
  empresaId: string,
  filtros: FiltrosPlano = {},
): Promise<PlanoAcaoEnriquecido[]> {
  return withEmpresa(empresaId, async () => {
    // Postgres.js suporta condições opcionais via valor sentinel + COALESCE no
    // SQL. Mantém a query estática e legível, sem composição de fragments.
    const statusList = filtros.status && filtros.status.length > 0 ? filtros.status : null;
    const fatorId = filtros.fator_id ?? null;
    const programa = filtros.programa ?? null;
    const rows = await sql<PlanoAcaoEnriquecido[]>`
      select
        p.id,
        p.empresa_id,
        p.fator_id,
        p.classificacao,
        p.programa,
        p.acao_id,
        p.titulo_custom,
        p.como_realizar_custom,
        p.responsavel,
        p.prazo::text as prazo,
        p.status,
        p.criado_em::text as criado_em,
        p.criado_por,
        p.atualizado_em::text as atualizado_em,
        a.titulo as acao_titulo,
        a.como_realizar as acao_como_realizar,
        coalesce(p.titulo_custom, a.titulo, 'Plano sem título') as titulo_efetivo,
        coalesce(p.como_realizar_custom, a.como_realizar, '') as como_realizar_efetivo,
        f.nome as fator_nome,
        f.dim_id as dim_id,
        d.nome as dim_nome
        from public.plano_acao p
        left join public.acao_recomendada a on a.id = p.acao_id
        left join public.fator_nr1 f on f.id = p.fator_id
        left join public.dim_nr1 d on d.id = f.dim_id
       where p.empresa_id = ${empresaId}
         and (${statusList}::text[] is null or p.status = any(${statusList}::text[]))
         and (${fatorId}::text is null or p.fator_id = ${fatorId})
         and (${programa}::text is null or p.programa = ${programa})
       order by p.criado_em desc
    `;
    return rows;
  });
}

export interface NovoPlano {
  fator_id: string;
  classificacao: Classificacao;
  /** Se vem do catálogo. */
  acao_id?: string | null;
  titulo_custom?: string | null;
  como_realizar_custom?: string | null;
  responsavel: string;
  prazo?: string | null; // YYYY-MM-DD
  criado_por: string;
}

/**
 * Cria um plano de ação. O programa é derivado da classificação. Se acao_id
 * for fornecido, valida que existe no catálogo e bate com o programa esperado.
 */
export async function criarPlanoAcao(
  empresaId: string,
  dados: NovoPlano,
): Promise<PlanoAcao> {
  const programa = programaPara(dados.classificacao);
  return withEmpresa(empresaId, async () => {
    if (dados.acao_id) {
      const [acao] = await sql<{ programa: Programa }[]>`
        select programa from public.acao_recomendada where id = ${dados.acao_id} limit 1
      `;
      if (!acao) {
        throw new Error(`acao_recomendada ${dados.acao_id} não encontrada`);
      }
      if (acao.programa !== programa) {
        throw new Error(
          `acao_recomendada ${dados.acao_id} é do programa ${acao.programa}, esperado ${programa}`,
        );
      }
    }
    // Exige título quando não vem do catálogo.
    if (!dados.acao_id && !dados.titulo_custom) {
      throw new Error("Informe acao_id ou titulo_custom");
    }

    const [row] = await sql<PlanoAcao[]>`
      insert into public.plano_acao
        (empresa_id, fator_id, classificacao, programa, acao_id,
         titulo_custom, como_realizar_custom, responsavel, prazo, criado_por)
      values
        (${empresaId}, ${dados.fator_id}, ${dados.classificacao}, ${programa},
         ${dados.acao_id ?? null},
         ${dados.titulo_custom ?? null}, ${dados.como_realizar_custom ?? null},
         ${dados.responsavel}, ${dados.prazo ?? null}, ${dados.criado_por})
      returning id, empresa_id, fator_id, classificacao, programa, acao_id,
                titulo_custom, como_realizar_custom, responsavel,
                prazo::text as prazo, status,
                criado_em::text as criado_em, criado_por,
                atualizado_em::text as atualizado_em
    `;
    return row;
  });
}

/** Atualiza status de um plano (sst|admin). Retorna NULL se não existir. */
export async function atualizarStatusPlano(
  empresaId: string,
  id: string,
  novoStatus: StatusPlano,
): Promise<PlanoAcao | null> {
  return withEmpresa(empresaId, async () => {
    const [row] = await sql<PlanoAcao[]>`
      update public.plano_acao
         set status = ${novoStatus},
             atualizado_em = now()
       where id = ${id}
         and empresa_id = ${empresaId}
      returning id, empresa_id, fator_id, classificacao, programa, acao_id,
                titulo_custom, como_realizar_custom, responsavel,
                prazo::text as prazo, status,
                criado_em::text as criado_em, criado_por,
                atualizado_em::text as atualizado_em
    `;
    return row ?? null;
  });
}

/** Lista o catálogo inteiro (uso por UI de seleção de ação). */
export async function listarCatalogoAcoes(): Promise<AcaoRecomendada[]> {
  // Catálogo é global — não precisa de withEmpresa, mas mantemos o pattern
  // (lib/db sql usa sqlAdmin fora de escopo, o que é OK para catálogo).
  const rows = await sql<AcaoRecomendada[]>`
    select id, programa, dim_id, fator_id, titulo, como_realizar, responsavel_padrao
      from public.acao_recomendada
     order by programa, titulo
  `;
  return rows;
}
