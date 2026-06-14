import "server-only";
import { sql } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";
import {
  normalizarItemDRPS,
  classificar,
  type Classificacao,
  type TipoPerguntaDRPS,
} from "@/lib/drps-escoragem";

/**
 * Comparativo histórico DRPS · Onda 5 (Dev B · §8 BACKLOG_OKEBAMBO).
 *
 * O eixo de agregação é o `ciclo` (vem de `drps_campanha.ciclo` — ex.: "q1-2026",
 * "2026-mar"). Cada resposta DRPS herda o ciclo da sua campanha.
 *
 * Identificação de ciclos (decisão de produto, documentada aqui):
 *   - O `ciclo` é uma string LIVRE controlada pelo SST ao criar a campanha.
 *     Mantemos livre (não enum) para acomodar cadências distintas:
 *       trimestral ("q1-2026"), mensal ("2026-mar"), semestral ("h1-2026"),
 *       e ad-hoc ("pos-intervencao-ago-2026").
 *   - A ordenação é LEXICOGRÁFICA por padrão. Os formatos sugeridos pela UI
 *     ("aaaa-NN", "qN-aaaa", "aaaa-mmm") ordenam corretamente em ASCII quando
 *     o ano vem PRIMEIRO. Documentamos isso no formulário Nova Campanha.
 *   - Para o gráfico de evolução, a ordem é resolvida no SQL pelo `min(criado_em)`
 *     de cada ciclo (mais estável que ordenar a string).
 *
 * Mapeamento de `drps_pergunta.tipo` (catálogo do template) para
 * `TipoPerguntaDRPS` (módulo puro): a 0012 usa "impacto4" e "esgotamento5"
 * (nomes SQL), enquanto o módulo puro usa "escala_impacto" e
 * "escala_esgotamento". Convertemos no SELECT.
 */

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                      */
/* -------------------------------------------------------------------------- */

export interface MediaPorDim {
  dim_id: string;
  dim_nome: string;
  media: number;
  n_respostas: number;
}

export interface PontoSerie {
  ciclo: string;
  ciclo_label: string;
  ordem: number; // ordinal (1..N) baseado em min(criado_em) da campanha
  data_inicio: string; // primeiro respondido_em do ciclo
  media_geral: number;
  n_respostas: number;
  mediaPorDim: MediaPorDim[];
}

export interface SerieDimensoesOpts {
  from?: string; // ISO date
  to?: string;   // ISO date
  dimensoes?: string[]; // filtrar a quais dim_id mostrar
}

export interface ComparacaoDimensao {
  dim_id: string;
  dim_nome: string;
  mediaA: number;
  mediaB: number;
  nA: number;
  nB: number;
  delta: number;
  regressao: boolean;
  classificacaoA: Classificacao;
  classificacaoB: Classificacao;
}

export interface AlertaRegressao {
  dim_id: string;
  dim_nome: string;
  cicloAnterior: string;
  cicloAtual: string;
  mediaAnterior: number;
  mediaAtual: number;
  delta: number;
}

export interface ResumoMensal {
  mes: string; // 'YYYY-MM'
  media_geral: number;
  n_respostas: number;
  classificacao: Classificacao;
}

/* -------------------------------------------------------------------------- */
/*  Constantes                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Limiar de regressão alinhado ao BACKLOG §8: "delta > 0.5 pontos na escala
 * 1-5 = piorou". O sinal é POSITIVO porque na convenção PrevIA score maior =
 * mais risco; logo, delta = mediaAtual - mediaAnterior > 0.5 → regressão.
 */
export const LIMITE_REGRESSAO = 0.5;

/**
 * Mapeamento entre tipos da tabela `drps_pergunta` (catálogo SQL) e
 * `TipoPerguntaDRPS` do módulo puro `drps-escoragem.ts`.
 */
function mapTipo(tipoSQL: string): TipoPerguntaDRPS {
  switch (tipoSQL) {
    case "likert5_inverso":
      return "likert5_inverso";
    case "likert3_freq":
      return "likert3_freq";
    case "impacto4":
      return "escala_impacto";
    case "esgotamento5":
      return "escala_esgotamento";
    case "demografia":
      return "demografico";
    case "multi_choice":
      return "multi_choice";
    case "texto":
      return "texto_livre";
    default:
      return "texto_livre";
  }
}

/* -------------------------------------------------------------------------- */
/*  serieDimensoes                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Retorna a evolução das 5 dimensões NR-1 ao longo dos ciclos da empresa.
 *
 * Estratégia:
 *   1. JOIN drps_resposta_item ▸ pergunta ▸ resposta ▸ campanha ▸ dim_nr1.
 *   2. Filtra por respostas com campanha vinculada (Onda 5+; respostas órfãs
 *      vão para 'backfill-onda4' após a migration).
 *   3. Agrega por ciclo + dim_id, com normalização item-a-item via
 *      `normalizarItemDRPS` (módulo puro — fonte de verdade da escoragem).
 */
export async function serieDimensoes(
  empresaId: string,
  opts: SerieDimensoesOpts = {},
): Promise<PontoSerie[]> {
  const from = opts.from ?? null;
  const to = opts.to ?? null;

  return withEmpresa(empresaId, async () => {
    // 1) Pega todos os itens de respostas dessa empresa, com dim/ciclo/tipo.
    type Linha = {
      ciclo: string;
      dim_id: string;
      dim_nome: string;
      tipo: string;
      valor_int: number | null;
      respondido_em: string;
      resposta_id: string;
    };
    const linhas = await sql<Linha[]>`
      select c.ciclo,
             d.id   as dim_id,
             d.nome as dim_nome,
             p.tipo,
             ri.valor_int,
             r.respondido_em::text as respondido_em,
             r.id as resposta_id
        from public.drps_resposta r
        join public.drps_campanha c on c.id = r.campanha_id
        join public.drps_resposta_item ri on ri.resposta_id = r.id
        join public.drps_pergunta p on p.id = ri.pergunta_id
        join public.dim_nr1 d on d.id = p.dim_id
       where r.empresa_id = ${empresaId}
         and r.campanha_id is not null
         and (${from}::timestamptz is null or r.respondido_em >= ${from}::timestamptz)
         and (${to}::timestamptz   is null or r.respondido_em <= ${to}::timestamptz)
       order by r.respondido_em asc
    `;

    // 2) Agrega em memória — fácil de testar e mantém uma única fonte de verdade
    //    (normalizarItemDRPS).
    type AccPonto = {
      ciclo: string;
      data_inicio: string;
      respostas: Set<string>;
      somaGeral: number;
      nGeral: number;
      porDim: Map<
        string,
        { dim_nome: string; soma: number; n: number; respostas: Set<string> }
      >;
    };
    const pontos = new Map<string, AccPonto>();
    const dimFiltro = opts.dimensoes && opts.dimensoes.length > 0
      ? new Set(opts.dimensoes)
      : null;

    for (const l of linhas) {
      if (dimFiltro && !dimFiltro.has(l.dim_id)) continue;
      const v = normalizarItemDRPS({
        tipo: mapTipo(l.tipo),
        valor_int: l.valor_int,
      });
      if (v == null) continue;

      let p = pontos.get(l.ciclo);
      if (!p) {
        p = {
          ciclo: l.ciclo,
          data_inicio: l.respondido_em,
          respostas: new Set<string>(),
          somaGeral: 0,
          nGeral: 0,
          porDim: new Map(),
        };
        pontos.set(l.ciclo, p);
      }
      p.respostas.add(l.resposta_id);
      p.somaGeral += v;
      p.nGeral += 1;
      const accDim = p.porDim.get(l.dim_id) ?? {
        dim_nome: l.dim_nome,
        soma: 0,
        n: 0,
        respostas: new Set<string>(),
      };
      accDim.soma += v;
      accDim.n += 1;
      accDim.respostas.add(l.resposta_id);
      p.porDim.set(l.dim_id, accDim);
    }

    // 3) Ordenação: por data_inicio (mais estável que lexicográfica do ciclo).
    const ordenado = [...pontos.values()].sort((a, b) =>
      a.data_inicio.localeCompare(b.data_inicio),
    );

    return ordenado.map((p, i) => ({
      ciclo: p.ciclo,
      ciclo_label: p.ciclo,
      ordem: i + 1,
      data_inicio: p.data_inicio,
      media_geral:
        p.nGeral > 0 ? Number((p.somaGeral / p.nGeral).toFixed(3)) : 0,
      n_respostas: p.respostas.size,
      mediaPorDim: [...p.porDim.entries()]
        .map(([dim_id, ac]) => ({
          dim_id,
          dim_nome: ac.dim_nome,
          media: Number((ac.soma / ac.n).toFixed(3)),
          n_respostas: ac.respostas.size,
        }))
        .sort((a, b) => a.dim_nome.localeCompare(b.dim_nome)),
    }));
  });
}

/* -------------------------------------------------------------------------- */
/*  compararCiclos                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Compara duas séries (ciclo A vs B). Por convenção:
 *   - delta = mediaB - mediaA  (score maior = mais risco).
 *   - regressao = delta > LIMITE_REGRESSAO.
 *
 * Retorna uma linha por dimensão. Se uma dimensão só aparecer em um dos ciclos,
 * a outra ponta vai como 0 (com n=0) — útil pra UI sinalizar "novo".
 */
export async function compararCiclos(
  empresaId: string,
  cicloA: string,
  cicloB: string,
): Promise<ComparacaoDimensao[]> {
  const serie = await serieDimensoes(empresaId);
  const ptA = serie.find((p) => p.ciclo === cicloA);
  const ptB = serie.find((p) => p.ciclo === cicloB);
  if (!ptA && !ptB) return [];

  const dims = new Map<string, string>(); // dim_id → dim_nome
  for (const d of ptA?.mediaPorDim ?? []) dims.set(d.dim_id, d.dim_nome);
  for (const d of ptB?.mediaPorDim ?? []) dims.set(d.dim_id, d.dim_nome);

  const result: ComparacaoDimensao[] = [];
  for (const [dim_id, dim_nome] of dims) {
    const a = ptA?.mediaPorDim.find((x) => x.dim_id === dim_id);
    const b = ptB?.mediaPorDim.find((x) => x.dim_id === dim_id);
    const mediaA = a?.media ?? 0;
    const mediaB = b?.media ?? 0;
    const delta = Number((mediaB - mediaA).toFixed(3));
    result.push({
      dim_id,
      dim_nome,
      mediaA,
      mediaB,
      nA: a?.n_respostas ?? 0,
      nB: b?.n_respostas ?? 0,
      delta,
      regressao: delta > LIMITE_REGRESSAO,
      classificacaoA: classificar(mediaA),
      classificacaoB: classificar(mediaB),
    });
  }
  return result.sort((a, b) => b.delta - a.delta);
}

/* -------------------------------------------------------------------------- */
/*  alertasRegressao                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Lista as dimensões em regressão entre os DOIS ciclos consecutivos mais
 * recentes da empresa. Retorna [] se houver menos de 2 ciclos.
 */
export async function alertasRegressao(
  empresaId: string,
): Promise<AlertaRegressao[]> {
  const serie = await serieDimensoes(empresaId);
  if (serie.length < 2) return [];
  const anterior = serie[serie.length - 2];
  const atual = serie[serie.length - 1];

  const dims = new Map<string, string>();
  for (const d of anterior.mediaPorDim) dims.set(d.dim_id, d.dim_nome);
  for (const d of atual.mediaPorDim) dims.set(d.dim_id, d.dim_nome);

  const alertas: AlertaRegressao[] = [];
  for (const [dim_id, dim_nome] of dims) {
    const mA = anterior.mediaPorDim.find((x) => x.dim_id === dim_id)?.media ?? 0;
    const mB = atual.mediaPorDim.find((x) => x.dim_id === dim_id)?.media ?? 0;
    const delta = Number((mB - mA).toFixed(3));
    if (delta > LIMITE_REGRESSAO) {
      alertas.push({
        dim_id,
        dim_nome,
        cicloAnterior: anterior.ciclo,
        cicloAtual: atual.ciclo,
        mediaAnterior: mA,
        mediaAtual: mB,
        delta,
      });
    }
  }
  return alertas.sort((a, b) => b.delta - a.delta);
}

/* -------------------------------------------------------------------------- */
/*  resumoMensal                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Evolução mês-a-mês para um ano (cards "Jan: 2.4 · Fev: 2.7 ...").
 * Independe de ciclo — usa `respondido_em` direto. Útil pra dashboards
 * comprimidos quando os ciclos são longos (semestrais).
 */
export async function resumoMensal(
  empresaId: string,
  year: number,
): Promise<ResumoMensal[]> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("ano inválido");
  }
  const yearStr = String(year);

  return withEmpresa(empresaId, async () => {
    type Linha = {
      mes: string;
      tipo: string;
      valor_int: number | null;
      resposta_id: string;
    };
    const linhas = await sql<Linha[]>`
      select to_char(r.respondido_em, 'YYYY-MM') as mes,
             p.tipo,
             ri.valor_int,
             r.id as resposta_id
        from public.drps_resposta r
        join public.drps_resposta_item ri on ri.resposta_id = r.id
        join public.drps_pergunta p on p.id = ri.pergunta_id
       where r.empresa_id = ${empresaId}
         and date_part('year', r.respondido_em) = ${yearStr}::int
    `;

    const acc = new Map<
      string,
      { soma: number; n: number; respostas: Set<string> }
    >();
    for (const l of linhas) {
      const v = normalizarItemDRPS({
        tipo: mapTipo(l.tipo),
        valor_int: l.valor_int,
      });
      if (v == null) continue;
      const cur = acc.get(l.mes) ?? { soma: 0, n: 0, respostas: new Set<string>() };
      cur.soma += v;
      cur.n += 1;
      cur.respostas.add(l.resposta_id);
      acc.set(l.mes, cur);
    }

    return [...acc.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, ac]) => {
        const media = ac.n > 0 ? Number((ac.soma / ac.n).toFixed(3)) : 0;
        return {
          mes,
          media_geral: media,
          n_respostas: ac.respostas.size,
          classificacao: classificar(media),
        };
      });
  });
}

/* -------------------------------------------------------------------------- */
/*  Helper pra export CSV (consumido pela rota /api/drps/historico/csv)        */
/* -------------------------------------------------------------------------- */

export interface LinhaHistoricoCSV {
  ciclo: string;
  dim_id: string;
  dim_nome: string;
  media: number;
  n_respostas: number;
  classificacao: Classificacao;
}

export async function historicoParaCSV(
  empresaId: string,
): Promise<LinhaHistoricoCSV[]> {
  const serie = await serieDimensoes(empresaId);
  const rows: LinhaHistoricoCSV[] = [];
  for (const p of serie) {
    for (const d of p.mediaPorDim) {
      rows.push({
        ciclo: p.ciclo,
        dim_id: d.dim_id,
        dim_nome: d.dim_nome,
        media: d.media,
        n_respostas: d.n_respostas,
        classificacao: classificar(d.media),
      });
    }
  }
  return rows;
}
