import "server-only";
import { sql } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";
import {
  calcularEscoreAgregado,
  classificar,
  validarAmostra,
  normalizarItemDRPS,
  type Classificacao,
  type RespostaAgregada,
  type TipoPerguntaDRPS,
} from "@/lib/drps-escoragem";

/**
 * Análise setorizada do DRPS (Onda 5 · Dev A · §7 do BACKLOG_OKEBAMBO).
 *
 * Tudo aqui é tenant-scoped (`withEmpresa(empresaId, ...)`) — RLS no banco
 * garante isolamento por empresa, e o k-anonimato (n ≥ 7) é aplicado em
 * cima do agregado antes de exibir médias.
 *
 * Convenções:
 *   - Setor com `n_respostas < 7` → `media`/`classificacao` retornados como
 *     `null` (LGPD §3 do escoragem) + flag `amostra_insuficiente=true`.
 *   - Mapeamento de tipos: `drps_pergunta.tipo` ('likert5_inverso',
 *     'likert3_freq', 'impacto4', 'esgotamento5'...) ↔ `TipoPerguntaDRPS`
 *     (puro, do `drps-escoragem`). `impacto4` ↔ `escala_impacto`,
 *     `esgotamento5` ↔ `escala_esgotamento`.
 */

/* -------------------------------------------------------------------------- */
/*  Tipos exportados                                                           */
/* -------------------------------------------------------------------------- */

export interface AnaliseDimensaoSetor {
  dim_id: string;
  dim_nome: string;
  media: number | null;
  classificacao: Classificacao | null;
}

export interface AnalisePorSetor {
  setor: string;
  n_respostas: number;
  media: number | null;
  classificacao: Classificacao | null;
  amostra_insuficiente: boolean;
  por_dimensao: AnaliseDimensaoSetor[];
}

export interface AnalisePorContrato {
  forma_atuacao: string;
  n_respostas: number;
  media: number | null;
  classificacao: Classificacao | null;
  amostra_insuficiente: boolean;
}

export interface AnalisePorTempoEmpresa {
  faixa: string;
  n_respostas: number;
  media: number | null;
  classificacao: Classificacao | null;
  amostra_insuficiente: boolean;
}

export interface Outlier {
  setor: string;
  media: number;
  desvio: number;          // diferença absoluta em pontos vs média geral
  n_respostas: number;
  classificacao: Classificacao;
}

export interface ResumoExecutivo {
  media_geral: number | null;
  n_total: number;
  n_setores: number;
  n_setores_alto: number;
  dimensao_mais_critica: { dim_id: string; dim_nome: string; media: number } | null;
  contrato_mais_critico: { forma: string; media: number; n: number } | null;
}

/* -------------------------------------------------------------------------- */
/*  Helpers internos                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Estrutura de uma "linha de resposta" trazida do banco:
 * uma linha por (resposta_id, pergunta_id) com o valor normalizado.
 */
interface LinhaResposta {
  resposta_id: string;
  setor: string | null;
  forma_atuacao: string | null;
  tempo_empresa: string | null;
  pergunta_codigo: string;
  tipo: string;
  valor_int: number | null;
  dim_id: string | null;
}

const TIPO_BANCO_PARA_ESCORAGEM: Record<string, TipoPerguntaDRPS> = {
  likert5_inverso: "likert5_inverso",
  likert3_freq: "likert3_freq",
  impacto4: "escala_impacto",
  esgotamento5: "escala_esgotamento",
};

function setorNormalizado(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : "(não informado)";
}

function classificacaoTempoEmpresa(s: string | null | undefined): string {
  // Agrupa o texto livre de Q3 nas 4 faixas oficiais do BACKLOG §2.
  // Se o usuário usou o select sugerido, cai direto na faixa correta.
  const t = (s ?? "").trim().toLowerCase();
  if (!t) return "(não informado)";
  if (/menos|< ?6 ?m|6 ?meses ou/.test(t)) return "< 6m";
  if (/^6 ?m|6 ?meses a|6 a 12|6m ?-/.test(t)) return "6m–1a";
  if (/1 ?a ?3|1-3|1 a 3|um a tr/.test(t)) return "1–3a";
  if (/mais|> ?3|acima de 3|3 ?\+/.test(t)) return "> 3a";
  return t.slice(0, 40);
}

/** Constrói o array de RespostaAgregada a partir das linhas do banco. */
function agruparRespostas(linhas: LinhaResposta[]): RespostaAgregada[] {
  const porResposta = new Map<string, RespostaAgregada & { _setor?: string | null }>();
  for (const l of linhas) {
    let r = porResposta.get(l.resposta_id);
    if (!r) {
      r = {
        setor: l.setor,
        escorePorPergunta: new Map(),
        dimensaoPorPergunta: new Map(),
      };
      porResposta.set(l.resposta_id, r);
    }
    const tipoPuro = TIPO_BANCO_PARA_ESCORAGEM[l.tipo];
    if (!tipoPuro) continue;
    const valor = normalizarItemDRPS({ tipo: tipoPuro, valor_int: l.valor_int });
    if (valor == null) continue;
    r.escorePorPergunta.set(l.pergunta_codigo, valor);
    if (l.dim_id) r.dimensaoPorPergunta.set(l.pergunta_codigo, l.dim_id);
  }
  return Array.from(porResposta.values());
}

/* -------------------------------------------------------------------------- */
/*  analisePorSetor                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Para cada setor declarado em Q1: média DRPS, classificação e médias por
 * dimensão NR-1. Aplica k-anonimato (n ≥ 7) — abaixo disso, oculta médias
 * mas devolve `n_respostas` (útil pra UI mostrar "amostra insuficiente").
 */
export async function analisePorSetor(
  empresaId: string,
): Promise<AnalisePorSetor[]> {
  return withEmpresa(empresaId, async () => {
    const linhas = await sql<LinhaResposta[]>`
      select r.id            as resposta_id,
             r.setor,
             r.forma_atuacao,
             r.tempo_empresa,
             p.codigo        as pergunta_codigo,
             p.tipo,
             ri.valor_int,
             p.dim_id
        from public.drps_resposta r
        join public.drps_resposta_item ri on ri.resposta_id = r.id
        join public.drps_pergunta p       on p.id = ri.pergunta_id
       where r.empresa_id = ${empresaId}
    `;

    // Catálogo de dimensões para fornecer nomes mesmo em setores sem
    // resposta em alguma dimensão específica.
    const dims = await sql<{ id: string; nome: string; ordem: number }[]>`
      select id, nome, ordem from public.dim_nr1 order by ordem
    `;

    // Agrupa linhas por setor.
    const porSetor = new Map<string, LinhaResposta[]>();
    for (const l of linhas) {
      const k = setorNormalizado(l.setor);
      const arr = porSetor.get(k) ?? [];
      arr.push(l);
      porSetor.set(k, arr);
    }

    const resultado: AnalisePorSetor[] = [];
    for (const [setor, linhasSetor] of porSetor) {
      const respostas = agruparRespostas(linhasSetor);
      const n_respostas = respostas.length;
      const amostra = validarAmostra(n_respostas);

      if (!amostra.ok) {
        resultado.push({
          setor,
          n_respostas,
          media: null,
          classificacao: null,
          amostra_insuficiente: true,
          por_dimensao: dims.map((d) => ({
            dim_id: d.id,
            dim_nome: d.nome,
            media: null,
            classificacao: null,
          })),
        });
        continue;
      }

      const ag = calcularEscoreAgregado(respostas);
      const media = ag.media_geral;
      const por_dimensao: AnaliseDimensaoSetor[] = dims.map((d) => {
        const mediaDim = ag.por_dim.get(d.id);
        if (mediaDim == null) {
          return { dim_id: d.id, dim_nome: d.nome, media: null, classificacao: null };
        }
        return {
          dim_id: d.id,
          dim_nome: d.nome,
          media: mediaDim,
          classificacao: classificar(mediaDim),
        };
      });

      resultado.push({
        setor,
        n_respostas,
        media,
        classificacao: classificar(media),
        amostra_insuficiente: false,
        por_dimensao,
      });
    }

    // Ordena por média descendente (piores primeiro). Setores sem média
    // (amostra insuficiente) vão pro final.
    resultado.sort((a, b) => {
      const ma = a.media ?? -1;
      const mb = b.media ?? -1;
      return mb - ma;
    });
    return resultado;
  });
}

/* -------------------------------------------------------------------------- */
/*  analisePorContrato (CRÍTICO para fiscalização MPT)                         */
/* -------------------------------------------------------------------------- */

/**
 * Mesma análise, agrupada por forma de contratação (CLT/PJ/Autônomo etc.).
 * Permite responder à pergunta de auditoria MPT: "trabalhador PJ está exposto
 * a mais risco psicossocial do que CLT?".
 */
export async function analisePorContrato(
  empresaId: string,
): Promise<AnalisePorContrato[]> {
  return withEmpresa(empresaId, async () => {
    const linhas = await sql<LinhaResposta[]>`
      select r.id            as resposta_id,
             r.setor,
             r.forma_atuacao,
             r.tempo_empresa,
             p.codigo        as pergunta_codigo,
             p.tipo,
             ri.valor_int,
             p.dim_id
        from public.drps_resposta r
        join public.drps_resposta_item ri on ri.resposta_id = r.id
        join public.drps_pergunta p       on p.id = ri.pergunta_id
       where r.empresa_id = ${empresaId}
    `;

    const porForma = new Map<string, LinhaResposta[]>();
    for (const l of linhas) {
      const k = (l.forma_atuacao ?? "").trim() || "(não informado)";
      const arr = porForma.get(k) ?? [];
      arr.push(l);
      porForma.set(k, arr);
    }

    const out: AnalisePorContrato[] = [];
    for (const [forma, linhasForma] of porForma) {
      const respostas = agruparRespostas(linhasForma);
      const n = respostas.length;
      const amostra = validarAmostra(n);
      if (!amostra.ok) {
        out.push({
          forma_atuacao: forma,
          n_respostas: n,
          media: null,
          classificacao: null,
          amostra_insuficiente: true,
        });
        continue;
      }
      const ag = calcularEscoreAgregado(respostas);
      out.push({
        forma_atuacao: forma,
        n_respostas: n,
        media: ag.media_geral,
        classificacao: classificar(ag.media_geral),
        amostra_insuficiente: false,
      });
    }

    // Ordena CLT primeiro depois piores médias.
    out.sort((a, b) => {
      const ma = a.media ?? -1;
      const mb = b.media ?? -1;
      return mb - ma;
    });
    return out;
  });
}

/* -------------------------------------------------------------------------- */
/*  analisePorTempoEmpresa                                                     */
/* -------------------------------------------------------------------------- */

const FAIXAS_TEMPO: readonly string[] = [
  "< 6m",
  "6m–1a",
  "1–3a",
  "> 3a",
  "(não informado)",
];

export async function analisePorTempoEmpresa(
  empresaId: string,
): Promise<AnalisePorTempoEmpresa[]> {
  return withEmpresa(empresaId, async () => {
    const linhas = await sql<LinhaResposta[]>`
      select r.id            as resposta_id,
             r.setor,
             r.forma_atuacao,
             r.tempo_empresa,
             p.codigo        as pergunta_codigo,
             p.tipo,
             ri.valor_int,
             p.dim_id
        from public.drps_resposta r
        join public.drps_resposta_item ri on ri.resposta_id = r.id
        join public.drps_pergunta p       on p.id = ri.pergunta_id
       where r.empresa_id = ${empresaId}
    `;

    const porFaixa = new Map<string, LinhaResposta[]>();
    for (const l of linhas) {
      const k = classificacaoTempoEmpresa(l.tempo_empresa);
      const arr = porFaixa.get(k) ?? [];
      arr.push(l);
      porFaixa.set(k, arr);
    }

    const map = new Map<string, AnalisePorTempoEmpresa>();
    for (const faixa of FAIXAS_TEMPO) {
      map.set(faixa, {
        faixa,
        n_respostas: 0,
        media: null,
        classificacao: null,
        amostra_insuficiente: true,
      });
    }

    for (const [faixa, linhasFaixa] of porFaixa) {
      const respostas = agruparRespostas(linhasFaixa);
      const n = respostas.length;
      const amostra = validarAmostra(n);
      if (!amostra.ok) {
        map.set(faixa, {
          faixa,
          n_respostas: n,
          media: null,
          classificacao: null,
          amostra_insuficiente: true,
        });
        continue;
      }
      const ag = calcularEscoreAgregado(respostas);
      map.set(faixa, {
        faixa,
        n_respostas: n,
        media: ag.media_geral,
        classificacao: classificar(ag.media_geral),
        amostra_insuficiente: false,
      });
    }

    return FAIXAS_TEMPO.map((f) => map.get(f)!).filter((v) => v.n_respostas > 0 || v.faixa !== "(não informado)");
  });
}

/* -------------------------------------------------------------------------- */
/*  outliersSetoriais                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Identifica setores cuja média de risco está acima do esperado vs. média
 * geral. Threshold: `media_setor > media_geral + 1.0` OU `media_setor >
 * media_geral + 0.5*desvio_padrao`. Lista descendente por desvio absoluto.
 *
 * Só considera setores com amostra válida (n ≥ 7).
 */
export async function outliersSetoriais(empresaId: string): Promise<Outlier[]> {
  const setores = await analisePorSetor(empresaId);
  const validos = setores.filter(
    (s): s is AnalisePorSetor & { media: number; classificacao: Classificacao } =>
      !s.amostra_insuficiente && s.media != null && s.classificacao != null,
  );
  if (validos.length === 0) return [];

  const mediaGeral =
    validos.reduce((acc, s) => acc + s.media, 0) / validos.length;

  // Desvio amostral.
  const variancia =
    validos.reduce((acc, s) => acc + Math.pow(s.media - mediaGeral, 2), 0) /
    validos.length;
  const dp = Math.sqrt(variancia);
  const threshold = Math.min(1.0, 0.5 * dp);

  const out: Outlier[] = [];
  for (const s of validos) {
    const desvio = s.media - mediaGeral;
    if (desvio > threshold) {
      out.push({
        setor: s.setor,
        media: s.media,
        desvio: Number(desvio.toFixed(3)),
        n_respostas: s.n_respostas,
        classificacao: s.classificacao,
      });
    }
  }
  out.sort((a, b) => b.desvio - a.desvio);
  return out;
}

/* -------------------------------------------------------------------------- */
/*  resumoExecutivo                                                            */
/* -------------------------------------------------------------------------- */

export async function resumoExecutivo(
  empresaId: string,
): Promise<ResumoExecutivo> {
  const [setores, contratos] = await Promise.all([
    analisePorSetor(empresaId),
    analisePorContrato(empresaId),
  ]);

  const n_total = setores.reduce((acc, s) => acc + s.n_respostas, 0);
  const validos = setores.filter(
    (s): s is AnalisePorSetor & { media: number; classificacao: Classificacao } =>
      !s.amostra_insuficiente && s.media != null && s.classificacao != null,
  );

  const media_geral =
    validos.length > 0
      ? Number(
          (validos.reduce((acc, s) => acc + s.media, 0) / validos.length).toFixed(
            3,
          ),
        )
      : null;

  const n_setores = setores.length;
  const n_setores_alto = validos.filter((s) => s.classificacao === "alto").length;

  // Dimensão mais crítica = aquela com maior média entre todas as dimensões
  // de todos os setores (ponderada pela amostra do setor).
  const acumuladorDim = new Map<
    string,
    { dim_nome: string; soma: number; n: number }
  >();
  for (const s of validos) {
    for (const d of s.por_dimensao) {
      if (d.media == null) continue;
      const cur = acumuladorDim.get(d.dim_id) ?? {
        dim_nome: d.dim_nome,
        soma: 0,
        n: 0,
      };
      cur.soma += d.media * s.n_respostas;
      cur.n += s.n_respostas;
      acumuladorDim.set(d.dim_id, cur);
    }
  }
  let dimensao_mais_critica: ResumoExecutivo["dimensao_mais_critica"] = null;
  for (const [dim_id, ac] of acumuladorDim) {
    const m = ac.n > 0 ? ac.soma / ac.n : 0;
    if (!dimensao_mais_critica || m > dimensao_mais_critica.media) {
      dimensao_mais_critica = { dim_id, dim_nome: ac.dim_nome, media: Number(m.toFixed(3)) };
    }
  }

  // Contrato mais crítico — entre os que têm amostra válida.
  const contratosValidos = contratos.filter(
    (c): c is AnalisePorContrato & { media: number } =>
      !c.amostra_insuficiente && c.media != null,
  );
  let contrato_mais_critico: ResumoExecutivo["contrato_mais_critico"] = null;
  for (const c of contratosValidos) {
    if (!contrato_mais_critico || c.media > contrato_mais_critico.media) {
      contrato_mais_critico = {
        forma: c.forma_atuacao,
        media: c.media,
        n: c.n_respostas,
      };
    }
  }

  return {
    media_geral,
    n_total,
    n_setores,
    n_setores_alto,
    dimensao_mais_critica,
    contrato_mais_critico,
  };
}
