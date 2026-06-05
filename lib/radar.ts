import { z } from "zod";
import { OFENSORES, TURNOS, K_MIN } from "@previa/contracts";

/**
 * Núcleo do Radar (escuta ativa por micro-pulsos), reutilizável por qualquer
 * canal (WhatsApp, app, totem). A privacidade é estrutural:
 *  - respostas são anônimas (sem PII, sem id de pessoa);
 *  - clusters só são revelados na leitura com k ≥ K_MIN.
 */

export { K_MIN };

/** energia: 1 (no limite) … 5 (ótima). risco 0-100 (maior = pior). */
export function energiaParaRisco(energiaMedia: number): number {
  return Math.round(((5 - energiaMedia) / 4) * 100);
}

/** Rótulos das opções de energia (o que o trabalhador vê). */
export const ENERGIA_OPCOES = [
  { valor: 5, label: "😀 Ótima" },
  { valor: 4, label: "🙂 Boa" },
  { valor: 3, label: "😐 Mais ou menos" },
  { valor: 2, label: "😟 Baixa" },
  { valor: 1, label: "😩 No limite" },
] as const;

/** Payload de UMA resposta de pulso (channel-agnostic). */
export const PulsoResposta = z
  .object({
    empresa_id: z.string().trim().min(1).max(60),
    cluster_setor: z.string().trim().min(1).max(80),
    cluster_turno: z.enum(TURNOS),
    cluster_site: z.string().trim().max(40).optional(),
    canal: z.enum(["whatsapp", "app", "totem"]).default("whatsapp"),
    energia: z.number().int().min(1).max(5),
    ofensor: z.enum(OFENSORES).optional(),
    duracao_seg: z.number().int().min(1).max(600).optional(),
  })
  .strict();
export type PulsoResposta = z.infer<typeof PulsoResposta>;
