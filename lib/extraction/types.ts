import type { OfensorTag, Severidade } from "@previa/contracts";

/** Nota clínica sugerida pela IA — fica DENTRO da clínica (não cruza a barreira). */
export interface NotaSugerida {
  topico: string;
  texto: string;
}

/** Resultado da análise de uma transcrição (parcial ou final). */
export interface ResultadoAnalise {
  /** Ofensores organizacionais detectados, com confiança 0-1. */
  ofensores: Array<{
    tag: OfensorTag;
    confidence: number;
    ocorrencias: number;
    /** Trecho que disparou (fica só na clínica; nunca vai no webhook). */
    evidencia?: string;
  }>;
  /** Severidade coletiva estimada (NÃO é diagnóstico individual). */
  severidade: Severidade;
  /** Notas clínicas sugeridas para o psicólogo (uso interno da clínica). */
  notas: NotaSugerida[];
  /** Bandeira de risco grave/iminente — exige decisão humana imediata. */
  riscoGrave: boolean;
  /** Qual backend produziu o resultado. */
  engine: "anthropic" | "heuristico";
}
