import type { Classificacao } from "@/lib/drps-escoragem";

/**
 * Matriz de Risco 3×3 · Onda 4 · §4 do BACKLOG_OKEBAMBO.
 *
 * Tabela oficial da Okêbambo (vide §4):
 *
 *                  Impacto Baixo │ Impacto Médio │ Impacto Alto
 * Prob. Alta       (não definido)│ Moderado      │ Alto
 * Prob. Média      Baixo         │ Moderado      │ Moderado
 * Prob. Baixa      Baixo         │ Baixo         │ Moderado
 *
 * Decisão: o cruzamento "Prob Alta × Impacto Baixo" não foi definido pelo
 * material. Convencionamos = **baixo**. Lógica: se o ofensor é frequente
 * mas o impacto na saúde é baixo (ex.: "barulho leve"), o risco psicossocial
 * agregado fica baixo. Documentado aqui para a auditoria do Revisor.
 *
 * Módulo PURO (sem server-only / sem import de DB) para que o componente
 * <MatrizRisco /> e o accordion possam consumir os rótulos/tabela direto.
 * A parte que usa DB (sugerirProbabilidade) vive em `matriz-risco-server.ts`.
 */

export type Probabilidade = "baixa" | "media" | "alta";
export type Impacto = "baixo" | "medio" | "alto";

/**
 * Aplica a matriz 3×3. Reproduz a tabela do §4 do BACKLOG exatamente, com
 * a célula "Alta × Baixo" preenchida como 'baixo' (vide docstring).
 */
export function classificarRisco(
  probabilidade: Probabilidade,
  impacto: Impacto,
): Classificacao {
  const m: Record<Probabilidade, Record<Impacto, Classificacao>> = {
    alta: { baixo: "baixo", medio: "moderado", alto: "alto" },
    media: { baixo: "baixo", medio: "moderado", alto: "moderado" },
    baixa: { baixo: "baixo", medio: "baixo", alto: "moderado" },
  };
  return m[probabilidade][impacto];
}

export interface SugestaoProbabilidade {
  probabilidade: Probabilidade;
  /** Fração de respostas que mencionaram o ofensor (0..1). */
  frequencia: number;
  /** N respostas consideradas. */
  n_respostas: number;
  /** N respostas que citaram o fator. */
  n_citacoes: number;
}

/**
 * Mapa visual (linha = probabilidade, coluna = impacto) com a classificação
 * de cada célula. Usado pelo componente <MatrizRisco /> para renderizar.
 */
export const MATRIZ_3x3: { prob: Probabilidade; impacto: Impacto; classe: Classificacao }[] = [
  { prob: "alta", impacto: "baixo", classe: classificarRisco("alta", "baixo") },
  { prob: "alta", impacto: "medio", classe: classificarRisco("alta", "medio") },
  { prob: "alta", impacto: "alto", classe: classificarRisco("alta", "alto") },
  { prob: "media", impacto: "baixo", classe: classificarRisco("media", "baixo") },
  { prob: "media", impacto: "medio", classe: classificarRisco("media", "medio") },
  { prob: "media", impacto: "alto", classe: classificarRisco("media", "alto") },
  { prob: "baixa", impacto: "baixo", classe: classificarRisco("baixa", "baixo") },
  { prob: "baixa", impacto: "medio", classe: classificarRisco("baixa", "medio") },
  { prob: "baixa", impacto: "alto", classe: classificarRisco("baixa", "alto") },
];

export function rotuloProbabilidade(p: Probabilidade): string {
  return { baixa: "Baixa", media: "Média", alta: "Alta" }[p];
}

export function rotuloImpacto(i: Impacto): string {
  return { baixo: "Baixo", medio: "Médio", alto: "Alto" }[i];
}
