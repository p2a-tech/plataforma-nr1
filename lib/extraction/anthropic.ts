import "server-only";
import { OFENSORES, OFENSORES_LABEL, type OfensorTag } from "@previa/contracts";
import type { ResultadoAnalise } from "./types";

/**
 * Adapter Claude (Anthropic) — extração estruturada via tool use.
 *
 * - Só roda se ANTHROPIC_API_KEY estiver presente.
 * - Usa prompt caching no bloco de SISTEMA (taxonomia + instruções são fixos),
 *   então só a transcrição varia entre chamadas → cache hit barato.
 * - Força a saída no formato do nosso contrato via uma "tool" obrigatória.
 * - Roda no perímetro da CLÍNICA: a transcrição entra, mas só o resultado
 *   estruturado (ofensores canônicos + severidade) é o que importa pro sistêmico.
 *
 * O SDK é importado dinamicamente para não quebrar o build se não instalado.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

const SYSTEM = `Você é um assistente de apoio a psicólogos do trabalho, especializado na NR-1 brasileira (riscos psicossociais). Sua função é ler a transcrição de um atendimento e extrair APENAS sinais sobre a ORGANIZAÇÃO DO TRABALHO, mapeando-os para uma taxonomia fixa de ofensores organizacionais.

REGRAS INVIOLÁVEIS:
- NUNCA produza diagnóstico clínico, CID, ou inferência sobre a pessoa.
- NUNCA inclua dados identificáveis (nome, idade, gênero, local específico).
- Só use as tags da taxonomia fornecida. Nada fora dela.
- Se não houver sinal organizacional claro, retorne lista vazia de ofensores.
- "severidade" é uma estimativa do quadro ORGANIZACIONAL coletivo, não da pessoa.
- "risco_grave" = true SOMENTE se houver indício de risco à vida/integridade (ideação suicida, violência iminente). É uma bandeira para decisão humana, não um diagnóstico.

Taxonomia permitida (tag → rótulo):
${OFENSORES.map((t) => `- ${t}: ${OFENSORES_LABEL[t as OfensorTag]}`).join("\n")}`;

const TOOL = {
  name: "registrar_analise",
  description:
    "Registra a análise organizacional estruturada da transcrição. Use SEMPRE esta ferramenta para responder.",
  input_schema: {
    type: "object" as const,
    properties: {
      ofensores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tag: { type: "string", enum: [...OFENSORES] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            ocorrencias: { type: "integer", minimum: 1, maximum: 50 },
          },
          required: ["tag", "confidence"],
        },
      },
      severidade: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
      risco_grave: { type: "boolean" },
      notas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topico: { type: "string" },
            texto: { type: "string" },
          },
          required: ["topico", "texto"],
        },
      },
    },
    required: ["ofensores", "severidade", "risco_grave", "notas"],
  },
};

export function anthropicDisponivel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function analisarComAnthropic(
  transcricao: string,
): Promise<ResultadoAnalise> {
  // import dinâmico — não quebra build se o pacote não estiver instalado
  const mod = await import("@anthropic-ai/sdk").catch(() => null);
  if (!mod) throw new Error("SDK @anthropic-ai/sdk indisponível");
  const Anthropic = mod.default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM,
        // cache do bloco fixo (taxonomia + regras) → chamadas seguintes baratas.
        // cast: o SDK instalado ainda não tipa cache_control, mas a API aceita.
        cache_control: { type: "ephemeral" },
      } as unknown as { type: "text"; text: string },
    ],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "registrar_analise" },
    messages: [
      {
        role: "user",
        content: `Transcrição (parcial ou final) do atendimento:\n\n"""${transcricao}"""`,
      },
    ],
  });

  const bloco = resp.content.find((c) => c.type === "tool_use");
  if (!bloco || bloco.type !== "tool_use") {
    throw new Error("Claude não retornou tool_use");
  }
  const out = bloco.input as {
    ofensores: Array<{ tag: OfensorTag; confidence: number; ocorrencias?: number }>;
    severidade: ResultadoAnalise["severidade"];
    risco_grave: boolean;
    notas: ResultadoAnalise["notas"];
  };

  return {
    ofensores: out.ofensores.map((o) => ({
      tag: o.tag,
      confidence: o.confidence,
      ocorrencias: o.ocorrencias ?? 1,
    })),
    severidade: out.severidade,
    notas: out.notas ?? [],
    riscoGrave: Boolean(out.risco_grave),
    engine: "anthropic",
  };
}
