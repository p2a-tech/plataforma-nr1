import "server-only";
import { analisarHeuristico } from "./heuristic";
import { analisarComAnthropic, anthropicDisponivel } from "./anthropic";
import type { ResultadoAnalise } from "./types";

export type { ResultadoAnalise, NotaSugerida } from "./types";

/**
 * Ponto de entrada da análise. Tenta Claude se houver chave; cai para o
 * extrator heurístico em qualquer falha (sem chave, erro de rede, etc.).
 * Assim o produto funciona end-to-end com OU sem IA externa configurada.
 */
export async function analisarTranscricao(
  transcricao: string,
): Promise<ResultadoAnalise> {
  const texto = (transcricao ?? "").trim();
  if (!texto) {
    return {
      ofensores: [],
      severidade: "baixa",
      notas: [],
      riscoGrave: false,
      engine: "heuristico",
    };
  }

  if (anthropicDisponivel()) {
    try {
      return await analisarComAnthropic(texto);
    } catch (e) {
      console.warn("[extraction] Anthropic falhou, usando heurístico:", e);
    }
  }
  return analisarHeuristico(texto);
}
