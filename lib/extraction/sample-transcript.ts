/**
 * Transcrição simulada (pt-BR) de um atendimento — usada no modo "Simular"
 * da tela de atendimento, para demonstrar o pipeline transcrição → IA sem
 * depender de microfone. Conteúdo fictício; representa fala sobre a
 * organização do trabalho (logística noturna), sem dados identificáveis.
 */

export interface FalaSimulada {
  quem: "paciente" | "psicologo";
  texto: string;
  /** atraso (ms) antes desta fala aparecer, simulando o ritmo da conversa */
  delayMs: number;
}

export const TRANSCRICAO_SIMULADA: FalaSimulada[] = [
  { quem: "psicologo", texto: "Oi, obrigado por aceitar essa conversa. Como você está se sentindo essa semana?", delayMs: 900 },
  { quem: "paciente", texto: "Pra ser sincero, bem cansado. Tô esgotado mesmo.", delayMs: 2200 },
  { quem: "psicologo", texto: "Entendo. O que você acha que tem pesado mais?", delayMs: 1800 },
  { quem: "paciente", texto: "É muito trabalho, sabe? Sobrecarga total. A gente não dá conta do volume no turno da noite.", delayMs: 2600 },
  { quem: "paciente", texto: "E ainda tem a pressão por meta o tempo todo, cobrança em cima da gente direto.", delayMs: 2400 },
  { quem: "psicologo", texto: "E como tem sido o sono, o descanso?", delayMs: 1800 },
  { quem: "paciente", texto: "Quase não durmo. Faço hora extra quase todo dia, às vezes dobro o turno. Sem pausa.", delayMs: 2600 },
  { quem: "paciente", texto: "O supervisor também não ajuda, é bem grosseiro, não escuta a gente.", delayMs: 2400 },
  { quem: "psicologo", texto: "Sinto muito que esteja assim. Você sente que seu esforço é reconhecido?", delayMs: 2000 },
  { quem: "paciente", texto: "Que nada, ninguém valoriza. A gente se mata de trabalhar e nunca um reconhecimento.", delayMs: 2600 },
  { quem: "psicologo", texto: "Vamos pensar juntos em alguns caminhos pra isso, tá? Você não está sozinho nisso.", delayMs: 2200 },
];

/** Versão concatenada (texto corrido) até um índice — usada na análise. */
export function transcricaoAte(falas: FalaSimulada[], idx: number): string {
  return falas
    .slice(0, idx + 1)
    .map((f) => f.texto)
    .join(" ");
}
