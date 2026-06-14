/**
 * Escoragem DRPS · Onda 4 (Dev B · §3 do BACKLOG_OKEBAMBO).
 *
 * Módulo PURO (sem dependência de DB / server-only) para que o cálculo seja
 * testável isoladamente e re-utilizável tanto no agregador da plataforma
 * quanto em scripts de calibração (planilha → calibrar pesos/thresholds).
 *
 * Convenção PrevIA: **score 1 = baixo risco · score 5 = alto risco**.
 * As faixas do BACKLOG §3 (≤2.0 baixo / 2.1-3.5 moderado / >3.5 alto)
 * são aplicadas direto sobre essa convenção.
 *
 * Tipos do instrumento Okêbambo (vide §2 do BACKLOG):
 *   - `likert5_inverso`: as perguntas Q5-Q16 são positivamente formuladas
 *     ("Você CONSEGUE dar conta?", "Você TEM apoio?"). Escala da planilha:
 *     Sempre=1 (bom, baixo risco) ... Nunca=5 (ruim, alto risco). Já está
 *     na convenção PrevIA — mantemos o valor sem inverter.
 *   - `likert3_freq` (Q11/Q12): "Com que frequência você sente carga
 *     emocional/esgotamento?". Raramente=1 (bom) · Frequentemente=3 (ruim).
 *     Mapeia 1-3 → 1-5 linearmente: 1→1, 2→3, 3→5.
 *   - `escala_impacto` (Q17): "Trabalho impactou sua saúde?" Não=1 (bom) ...
 *     Significativamente=4 (ruim). Mapeia 1-4 → 1-5: 1→1, 2→2.33, 3→3.67, 4→5.
 *   - `escala_esgotamento` (Q18): "Já se sentiu esgotado?" Nunca=1 (bom) ...
 *     Sempre=5 (ruim). Já em 1-5 com convenção PrevIA — mantém.
 *
 * Threshold final (BACKLOG §3): ≤2.0 baixo · 2.1-3.5 moderado · >3.5 alto.
 * Quem chama consome `classificar()` direto e não precisa pensar na escala.
 */

export type TipoPerguntaDRPS =
  | "likert5_inverso"
  | "likert3_freq"
  | "escala_impacto"
  | "escala_esgotamento"
  | "demografico"
  | "multi_choice"
  | "texto_livre";

export interface ItemRespostaDRPS {
  /** Tipo da pergunta (vem de drps_pergunta.tipo). */
  tipo: TipoPerguntaDRPS;
  /** Valor inteiro respondido (1..N conforme escala). NULL = não respondeu. */
  valor_int: number | null;
  /** Peso da pergunta no agregador (vem de drps_pergunta.peso). Default 1. */
  peso?: number;
}

export interface EscoreColaborador {
  /** Média 1-5 na "convenção PrevIA": quanto MAIOR, MAIOR o risco. */
  media: number;
  /** % de perguntas com peso respondidas (0..1). */
  completude: number;
  /** True se completude >= 0.7 (critério do BACKLOG §3). */
  valido: boolean;
}

const TIPOS_PESAVEIS: ReadonlySet<TipoPerguntaDRPS> = new Set([
  "likert5_inverso",
  "likert3_freq",
  "escala_impacto",
  "escala_esgotamento",
]);

/**
 * Normaliza o valor de UMA pergunta para a "convenção PrevIA" (1-5 onde
 * 5 = maior risco). Veja docstring do módulo para o porquê de cada cálculo.
 *
 * Retorna null se o item não é pesável (ex.: demografico, texto_livre) ou
 * se valor_int é null/inválido.
 */
export function normalizarItemDRPS(item: ItemRespostaDRPS): number | null {
  if (!TIPOS_PESAVEIS.has(item.tipo)) return null;
  const v = item.valor_int;
  if (v == null || !Number.isFinite(v)) return null;

  switch (item.tipo) {
    case "likert5_inverso": {
      // Q5-Q16 positivamente formuladas: Sempre=1 (bom) ... Nunca=5 (ruim).
      // Já está na convenção PrevIA (maior = mais risco). Mantém.
      if (v < 1 || v > 5) return null;
      return v;
    }
    case "likert3_freq": {
      // Raramente=1 (bom, pouco esgotamento) · Frequentemente=3 (ruim).
      // Mapeia 1-3 para 1-5 com semântica de risco crescente.
      // 1 → 1 (baixo risco) · 2 → 3 (médio) · 3 → 5 (alto risco).
      if (v < 1 || v > 3) return null;
      return (v - 1) * 2 + 1;
    }
    case "escala_impacto": {
      // Q17: Não=1 (bom) · Lev=2 · Mod=3 · Sig=4 (ruim).
      // 1-4 → 1-5 crescente: 1→1 · 2→2.33 · 3→3.67 · 4→5.
      if (v < 1 || v > 4) return null;
      return ((v - 1) * 4) / 3 + 1;
    }
    case "escala_esgotamento": {
      // Q18: Nunca=1 (bom) · Raramente=2 · Às vezes=3 · Frequentemente=4 · Sempre=5 (ruim).
      // Já está em 1-5 com convenção PrevIA. Mantém.
      if (v < 1 || v > 5) return null;
      return v;
    }
    default:
      return null;
  }
}

/**
 * Calcula o escore de UM colaborador (1 questionário respondido).
 *
 * Considera somente perguntas pesáveis (Likert / escalas). Peso default = 1.
 * Retorna `valido = false` se completude < 70%.
 */
export function calcularEscorePorColaborador(
  items: ItemRespostaDRPS[],
): EscoreColaborador {
  const pesaveis = items.filter((i) => TIPOS_PESAVEIS.has(i.tipo));
  const total = pesaveis.length;
  if (total === 0) {
    return { media: 0, completude: 0, valido: false };
  }

  let somaPonderada = 0;
  let somaPesos = 0;
  let respondidas = 0;

  for (const item of pesaveis) {
    const v = normalizarItemDRPS(item);
    if (v == null) continue;
    const peso = item.peso ?? 1;
    somaPonderada += v * peso;
    somaPesos += peso;
    respondidas += 1;
  }

  const completude = respondidas / total;
  const media = somaPesos > 0 ? somaPonderada / somaPesos : 0;
  return {
    media: Number(media.toFixed(3)),
    completude: Number(completude.toFixed(3)),
    valido: completude >= 0.7,
  };
}

export interface EscoreAgregado {
  media_geral: number;
  por_dim: Map<string, number>;
  por_setor: Map<string, number>;
  /** Quantas respostas válidas entraram no agregado. */
  n_respostas: number;
}

export interface RespostaAgregada {
  /** Setor declarado em Q1 (texto). */
  setor: string | null;
  /** Escore por pergunta (Map<codigo_pergunta, valor_normalizado_1_5>). */
  escorePorPergunta: Map<string, number>;
  /** Dimensão de cada pergunta — para agregar por dimensão. */
  dimensaoPorPergunta: Map<string, string>;
}

/**
 * Agrega escores entre múltiplas respostas (colaboradores).
 *
 * NÃO aplica k-anonimato — quem chama deve usar `validarAmostra` antes para
 * decidir se exibe ou oculta a métrica.
 */
export function calcularEscoreAgregado(
  respostas: RespostaAgregada[],
): EscoreAgregado {
  if (respostas.length === 0) {
    return { media_geral: 0, por_dim: new Map(), por_setor: new Map(), n_respostas: 0 };
  }

  // Média geral: média das médias por colaborador (cada respondente conta 1).
  const mediasIndividuais: number[] = [];
  // Acumuladores por dimensão e setor.
  const accDim = new Map<string, { soma: number; n: number }>();
  const accSetor = new Map<string, { soma: number; n: number }>();

  for (const r of respostas) {
    if (r.escorePorPergunta.size === 0) continue;
    let somaResp = 0;
    let nResp = 0;
    const somaPorDimResp = new Map<string, { soma: number; n: number }>();
    for (const [pergunta, valor] of r.escorePorPergunta) {
      somaResp += valor;
      nResp += 1;
      const dim = r.dimensaoPorPergunta.get(pergunta);
      if (dim) {
        const ac = somaPorDimResp.get(dim) ?? { soma: 0, n: 0 };
        ac.soma += valor;
        ac.n += 1;
        somaPorDimResp.set(dim, ac);
      }
    }
    if (nResp === 0) continue;
    const mediaResp = somaResp / nResp;
    mediasIndividuais.push(mediaResp);

    for (const [dim, ac] of somaPorDimResp) {
      const mediaDim = ac.soma / ac.n;
      const cur = accDim.get(dim) ?? { soma: 0, n: 0 };
      cur.soma += mediaDim;
      cur.n += 1;
      accDim.set(dim, cur);
    }

    const setor = r.setor?.trim() || "(não informado)";
    const curSetor = accSetor.get(setor) ?? { soma: 0, n: 0 };
    curSetor.soma += mediaResp;
    curSetor.n += 1;
    accSetor.set(setor, curSetor);
  }

  const media_geral =
    mediasIndividuais.length > 0
      ? mediasIndividuais.reduce((a, b) => a + b, 0) / mediasIndividuais.length
      : 0;

  const por_dim = new Map<string, number>();
  for (const [dim, ac] of accDim) {
    por_dim.set(dim, Number((ac.soma / ac.n).toFixed(3)));
  }
  const por_setor = new Map<string, number>();
  for (const [setor, ac] of accSetor) {
    por_setor.set(setor, Number((ac.soma / ac.n).toFixed(3)));
  }

  return {
    media_geral: Number(media_geral.toFixed(3)),
    por_dim,
    por_setor,
    n_respostas: mediasIndividuais.length,
  };
}

export type Classificacao = "baixo" | "moderado" | "alto";

/**
 * Classifica um score na convenção PrevIA (1-5, maior = mais risco):
 *   ≤ 2.0 → baixo
 *   2.1 - 3.5 → moderado
 *   > 3.5 → alto
 */
export function classificar(score: number): Classificacao {
  if (!Number.isFinite(score)) return "baixo";
  if (score <= 2.0) return "baixo";
  if (score <= 3.5) return "moderado";
  return "alto";
}

export interface ValidacaoAmostra {
  ok: boolean;
  /** n mínimo aplicado (k-anonimato = 7, alinhado ao radar). */
  minimo: number;
  motivo?: "k_anonimato";
}

/**
 * Critério de k-anonimato do BACKLOG §3: amostra mínima de 7 respostas
 * antes de divulgar agregados (espelha K_MIN do lib/radar para coerência).
 */
export function validarAmostra(n: number): ValidacaoAmostra {
  const minimo = 7;
  if (n >= minimo) return { ok: true, minimo };
  return { ok: false, minimo, motivo: "k_anonimato" };
}

/**
 * Helper de UI: cor/tone do badge para cada classificação.
 * Mantém alinhado com a paleta da plataforma (ok=verde, ambar=moderado,
 * alerta=vermelho).
 */
export function toneClassificacao(c: Classificacao): "ok" | "ambar" | "alerta" {
  switch (c) {
    case "baixo":
      return "ok";
    case "moderado":
      return "ambar";
    case "alto":
      return "alerta";
  }
}

export function rotuloClassificacao(c: Classificacao): string {
  switch (c) {
    case "baixo":
      return "Baixo";
    case "moderado":
      return "Moderado";
    case "alto":
      return "Alto";
  }
}
