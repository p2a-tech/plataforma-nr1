/**
 * Helpers puros de apresentação para a tela de Conformidade (E10).
 * Sem I/O, sem React — testáveis em isolamento.
 */

/**
 * Percentual de conformidade (0..100), arredondado.
 * Guarda contra divisão por zero quando o checklist está vazio (banco novo /
 * sem dados) — nesse caso retorna 0 em vez de NaN, que apareceria como "NaN%".
 */
export function pctConformidade(ok: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((ok / total) * 100);
}

/**
 * Está "conforme" quando há itens e nenhum pendente/atenção.
 * Com checklist vazio NÃO é conforme (não há evidência) — evita o falso-verde.
 */
export function estaConforme(total: number, pendentes: number, atencoes: number): boolean {
  return total > 0 && pendentes === 0 && atencoes === 0;
}
