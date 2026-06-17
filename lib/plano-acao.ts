import "server-only";
import { sql } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";
import { notificar } from "@/lib/notify";
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
  /** Carimbo de conclusão (Onda 9) — preenchido só quando status=concluido. */
  concluido_em: string | null;
  /** Guard de idempotência do aviso de vencimento (Onda 9). */
  notificado_vencimento_em: string | null;
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
        p.concluido_em::text as concluido_em,
        p.notificado_vencimento_em::text as notificado_vencimento_em,
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
       -- Acompanhamento (Onda 9): ordena por prazo (NULLS LAST = sem prazo no
       -- fim), depois por criação. Tarefas mais "urgentes" (prazo mais próximo)
       -- aparecem primeiro dentro de cada coluna/seção de status.
       order by p.prazo asc nulls last, p.criado_em desc
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
                atualizado_em::text as atualizado_em,
                concluido_em::text as concluido_em,
                notificado_vencimento_em::text as notificado_vencimento_em
    `;
    return row;
  });
}

/**
 * Atualiza status de um plano (sst|admin). Retorna NULL se não existir.
 *
 * Onda 9 — carimbo de conclusão:
 *   - ao virar 'concluido', seta concluido_em = now() (apenas se ainda não
 *     estava concluído, preservando o carimbo original em re-saves);
 *   - ao sair de 'concluido' (reabrir/cancelar/voltar), limpa concluido_em.
 */
export async function atualizarStatusPlano(
  empresaId: string,
  id: string,
  novoStatus: StatusPlano,
): Promise<PlanoAcao | null> {
  return withEmpresa(empresaId, async () => {
    const [row] = await sql<PlanoAcao[]>`
      update public.plano_acao
         set status = ${novoStatus},
             atualizado_em = now(),
             concluido_em = case
               when ${novoStatus} = 'concluido'
                 then coalesce(concluido_em, now())
               else null
             end
       where id = ${id}
         and empresa_id = ${empresaId}
      returning id, empresa_id, fator_id, classificacao, programa, acao_id,
                titulo_custom, como_realizar_custom, responsavel,
                prazo::text as prazo, status,
                criado_em::text as criado_em, criado_por,
                atualizado_em::text as atualizado_em,
                concluido_em::text as concluido_em,
                notificado_vencimento_em::text as notificado_vencimento_em
    `;
    return row ?? null;
  });
}

/** Campos editáveis de um plano (responsável / prazo). */
export interface EdicaoPlano {
  responsavel?: string;
  /** YYYY-MM-DD ou null para limpar. `undefined` = não mexe. */
  prazo?: string | null;
}

/**
 * Edita responsável e/ou prazo de um plano (sst|admin). Retorna NULL se não
 * existir. Só altera os campos fornecidos (COALESCE com sentinela). Ao mexer no
 * prazo, limpa o guard de notificação para que um novo vencimento volte a
 * disparar aviso (o prazo mudou, o aviso anterior pode ter perdido validade).
 */
export async function editarPlano(
  empresaId: string,
  id: string,
  dados: EdicaoPlano,
): Promise<PlanoAcao | null> {
  return withEmpresa(empresaId, async () => {
    const novoResponsavel = dados.responsavel ?? null;
    // Distingue "não mexer no prazo" (undefined) de "limpar prazo" (null).
    const mexePrazo = Object.prototype.hasOwnProperty.call(dados, "prazo");
    const novoPrazo = dados.prazo ?? null;
    const [row] = await sql<PlanoAcao[]>`
      update public.plano_acao
         set responsavel = coalesce(${novoResponsavel}, responsavel),
             prazo = case when ${mexePrazo} then ${novoPrazo}::date else prazo end,
             notificado_vencimento_em = case
               when ${mexePrazo} then null
               else notificado_vencimento_em
             end,
             atualizado_em = now()
       where id = ${id}
         and empresa_id = ${empresaId}
      returning id, empresa_id, fator_id, classificacao, programa, acao_id,
                titulo_custom, como_realizar_custom, responsavel,
                prazo::text as prazo, status,
                criado_em::text as criado_em, criado_por,
                atualizado_em::text as atualizado_em,
                concluido_em::text as concluido_em,
                notificado_vencimento_em::text as notificado_vencimento_em
    `;
    return row ?? null;
  });
}

/* -------------------------------------------------------------------------- */
/*  Onda 9 · Acompanhamento + vencimentos                                      */
/* -------------------------------------------------------------------------- */

export interface ResumoPlanos {
  por_status: Record<StatusPlano, number>;
  /** Planos abertos (pendente|em_andamento) com prazo < hoje. */
  vencidos: number;
  /** Planos abertos com prazo nos próximos 7 dias (hoje..hoje+7, inclusive). */
  a_vencer_7d: number;
  total: number;
  /** % de planos concluídos sobre o total (0..100, inteiro). */
  perc_concluido: number;
}

/**
 * Resumo agregado dos planos da empresa para os cards do topo da tela de
 * acompanhamento. Uma única query agregada (sem trazer todas as linhas).
 *
 * Regras de prazo (baseadas em current_date no fuso do banco):
 *   - vencidos: status em (pendente, em_andamento) E prazo < hoje.
 *   - a_vencer_7d: status aberto E prazo entre hoje e hoje+7 (inclusive).
 * Planos concluídos/cancelados nunca contam como vencidos/a-vencer.
 */
export async function resumoPlanos(empresaId: string): Promise<ResumoPlanos> {
  return withEmpresa(empresaId, async () => {
    const [r] = await sql<
      {
        pendente: string;
        em_andamento: string;
        concluido: string;
        cancelado: string;
        vencidos: string;
        a_vencer_7d: string;
        total: string;
      }[]
    >`
      select
        count(*) filter (where status = 'pendente')::int      as pendente,
        count(*) filter (where status = 'em_andamento')::int  as em_andamento,
        count(*) filter (where status = 'concluido')::int     as concluido,
        count(*) filter (where status = 'cancelado')::int     as cancelado,
        count(*) filter (
          where status in ('pendente','em_andamento')
            and prazo is not null
            and prazo < current_date
        )::int as vencidos,
        count(*) filter (
          where status in ('pendente','em_andamento')
            and prazo is not null
            and prazo >= current_date
            and prazo <= current_date + 7
        )::int as a_vencer_7d,
        count(*)::int as total
        from public.plano_acao
       where empresa_id = ${empresaId}
    `;
    const por_status: Record<StatusPlano, number> = {
      pendente: Number(r?.pendente ?? 0),
      em_andamento: Number(r?.em_andamento ?? 0),
      concluido: Number(r?.concluido ?? 0),
      cancelado: Number(r?.cancelado ?? 0),
    };
    const total = Number(r?.total ?? 0);
    const perc_concluido =
      total > 0 ? Math.round((por_status.concluido / total) * 100) : 0;
    return {
      por_status,
      vencidos: Number(r?.vencidos ?? 0),
      a_vencer_7d: Number(r?.a_vencer_7d ?? 0),
      total,
      perc_concluido,
    };
  });
}

export interface ResultadoVencimentos {
  /** Quantos planos vencidos receberam aviso NESTA execução. */
  notificados: number;
}

/**
 * Varre os planos abertos (pendente|em_andamento) vencidos (prazo < hoje) que
 * AINDA não foram notificados (notificado_vencimento_em IS NULL) e, para cada
 * um, dispara `notificar({tipo:'generico'})` + carimba notificado_vencimento_em.
 *
 * Idempotente: o carimbo garante 1 aviso por plano. Rodar de novo (ou no
 * carregamento da página a cada visita) não duplica notificações.
 *
 * Isolada por empresa via withEmpresa (RLS) — só vê/atualiza planos do tenant.
 */
export async function verificarVencimentos(
  empresaId: string,
): Promise<ResultadoVencimentos> {
  return withEmpresa(empresaId, async () => {
    // 1) Seleciona os candidatos (vencidos, abertos, ainda não notificados),
    //    já enriquecidos com o título efetivo p/ compor o corpo do aviso.
    const pendentes = await sql<
      {
        id: string;
        responsavel: string;
        prazo: string | null;
        titulo_efetivo: string;
        fator_nome: string | null;
      }[]
    >`
      select
        p.id,
        p.responsavel,
        p.prazo::text as prazo,
        coalesce(p.titulo_custom, a.titulo, 'Plano de ação') as titulo_efetivo,
        f.nome as fator_nome
        from public.plano_acao p
        left join public.acao_recomendada a on a.id = p.acao_id
        left join public.fator_nr1 f on f.id = p.fator_id
       where p.empresa_id = ${empresaId}
         and p.status in ('pendente','em_andamento')
         and p.prazo is not null
         and p.prazo < current_date
         and p.notificado_vencimento_em is null
       order by p.prazo asc
    `;

    let notificados = 0;
    for (const plano of pendentes) {
      // 2) Carimba ANTES de notificar e só prossegue se a linha ainda estava
      //    sem carimbo (UPDATE ... WHERE notificado_vencimento_em IS NULL).
      //    Isso fecha a corrida entre dois carregamentos concorrentes: só um
      //    "ganha" a linha e dispara o aviso.
      const carimbado = await sql<{ id: string }[]>`
        update public.plano_acao
           set notificado_vencimento_em = now()
         where id = ${plano.id}
           and empresa_id = ${empresaId}
           and notificado_vencimento_em is null
        returning id
      `;
      if (carimbado.length === 0) continue;

      const alvo = plano.fator_nome
        ? `${plano.titulo_efetivo} (${plano.fator_nome})`
        : plano.titulo_efetivo;
      await notificar({
        tipo: "generico",
        empresa_id: empresaId,
        titulo: "Plano de ação vencido",
        corpo: `${alvo} venceu em ${plano.prazo} (responsável ${plano.responsavel}).`,
      });
      notificados += 1;
    }

    return { notificados };
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
