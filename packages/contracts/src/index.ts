/**
 * ============================================================================
 *  @previa/contracts — A BARREIRA DE SIGILO COMO CÓDIGO
 * ============================================================================
 *  Este pacote define o contrato ÚNICO entre a clínica parceira e a PrevIA.
 *
 *  Princípio (NR-1 + LGPD):
 *    - O conteúdo clínico NUNCA sai do perímetro da clínica.
 *    - Atravessa apenas: cluster agregado, ofensores organizacionais GENÉRICOS
 *      (taxonomia controlada), severidade estimada, duração.
 *    - Tudo o mais (transcript, áudio, PII, diagnóstico, anamnese, etc.)
 *      é rejeitado na fronteira por `.strict()`.
 *
 *  Qualquer mudança aqui é uma decisão de GOVERNANÇA, não de código.
 *  Adicionar um campo = abrir a barreira. Pense duas vezes.
 * ============================================================================
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Taxonomia canônica de ofensores organizacionais (NR-1)                    */
/*  Único vocabulário permitido pra descrever o que "atravessa" a barreira.   */
/* -------------------------------------------------------------------------- */
export const OFENSORES = [
  "sobrecarga_trabalho",
  "ritmo_pressao_metas",
  "conflito_lideranca",
  "jornada_descanso_insuficiente",
  "falta_reconhecimento",
  "inseguranca_emprego",
  "assedio_moral",
  "monotonia_falta_autonomia",
  "isolamento_apoio_social",
  "ambiguidade_de_papel",
  "violencia_terceiros",
] as const;

export const OfensorTag = z.enum(OFENSORES);
export type OfensorTag = z.infer<typeof OfensorTag>;

/** Rótulo legível em pt-BR para cada tag canônica. */
export const OFENSORES_LABEL: Record<OfensorTag, string> = {
  sobrecarga_trabalho: "Sobrecarga de trabalho",
  ritmo_pressao_metas: "Ritmo / pressão por metas",
  conflito_lideranca: "Conflito de liderança",
  jornada_descanso_insuficiente: "Jornada / descanso insuficiente",
  falta_reconhecimento: "Falta de reconhecimento",
  inseguranca_emprego: "Insegurança no emprego",
  assedio_moral: "Assédio moral",
  monotonia_falta_autonomia: "Monotonia / falta de autonomia",
  isolamento_apoio_social: "Isolamento / falta de apoio social",
  ambiguidade_de_papel: "Ambiguidade de papel",
  violencia_terceiros: "Violência de terceiros",
};

/* -------------------------------------------------------------------------- */
/*  Cluster — NUNCA identifica pessoa.                                         */
/*  K-anonymity é exigida no consumidor (rejeitar clusters com n < K_MIN).    */
/* -------------------------------------------------------------------------- */
export const K_MIN = 7;

export const TURNOS = ["manha", "tarde", "noite", "madrugada"] as const;
export const Turno = z.enum(TURNOS);
export type Turno = z.infer<typeof Turno>;

export const Cluster = z
  .object({
    setor: z.string().trim().min(1).max(80),
    turno: Turno,
    site: z.string().trim().max(40).optional(),
  })
  .strict();
export type Cluster = z.infer<typeof Cluster>;

/* -------------------------------------------------------------------------- */
/*  Ofensor identificado pela IA da clínica (sem evidências textuais cruas)    */
/* -------------------------------------------------------------------------- */
export const Ofensor = z
  .object({
    tag: OfensorTag,
    /** Confiança 0-1 reportada pelo extractor (Claude na infra da clínica). */
    confidence: z.number().min(0).max(1),
    /** Quantas vezes o tema apareceu na conversa (heurística do extractor). */
    ocorrencias: z.number().int().min(1).max(50).optional(),
  })
  .strict();
export type Ofensor = z.infer<typeof Ofensor>;

export const Severidade = z.enum(["baixa", "media", "alta", "critica"]);
export type Severidade = z.infer<typeof Severidade>;

/* -------------------------------------------------------------------------- */
/*  PAYLOAD do webhook clínica → PrevIA                                        */
/*  Este é O contrato. `.strict()` no objeto raiz e em cada subschema garante  */
/*  que qualquer campo desconhecido é REJEITADO.                               */
/* -------------------------------------------------------------------------- */
export const SessaoFinalizadaPayload = z
  .object({
    /** ID opaco da sessão (hash hex). Não-reidentificável. */
    session_id_anon: z
      .string()
      .regex(/^[a-f0-9]{32,64}$/i, "Esperado hash hex de 32-64 chars"),

    /** ID da clínica parceira (multitenancy). */
    clinica_id: z.string().min(1).max(120),

    /** Quando a sessão começou (ISO 8601). */
    iniciada_em: z.string().datetime({ offset: true }),

    /** Duração total da sessão (1-240 min). */
    duracao_minutos: z.number().int().min(1).max(240),

    /** Contexto agregado — NUNCA pessoa. */
    cluster: Cluster,

    /** Ofensores extraídos pela IA local (vocabulário controlado). */
    ofensores: z.array(Ofensor).max(10),

    /** Severidade estimada do quadro coletivo (não diagnóstico). */
    severidade_estimada: Severidade,

    /**
     * Exceção controlada ao anonimato — protocolo de risco grave/iminente.
     * Único momento em que se permite acionar o fluxo de emergência humano.
     * Se true, a clínica deve registrar separadamente como tratou
     * (esses detalhes NÃO atravessam aqui).
     */
    protocolo_emergencia_acionado: z.boolean().default(false),

    /** Versão do schema/extractor da clínica (auditabilidade). */
    versao_extractor: z.string().max(40),
  })
  .strict();
export type SessaoFinalizadaPayload = z.infer<typeof SessaoFinalizadaPayload>;

/* -------------------------------------------------------------------------- */
/*  Campos PROIBIDOS de cruzar a barreira (documentação executável).          */
/*  `.strict()` já rejeita qualquer chave fora do schema, mas esta lista       */
/*  serve como (a) documentação pra revisores e (b) base de testes que        */
/*  garantem que nenhum desses campos jamais seja aceito.                      */
/* -------------------------------------------------------------------------- */
export const CAMPOS_PROIBIDOS = [
  "transcript",
  "transcript_url",
  "audio_url",
  "audio_blob",
  "paciente_id",
  "paciente_nome",
  "paciente_cpf",
  "paciente_email",
  "paciente_telefone",
  "paciente_idade",
  "paciente_genero",
  "diagnostico",
  "cid",
  "medicacao",
  "sintomas",
  "anamnese",
  "queixa_principal",
  "historico_clinico",
  "psicologo_id",
  "psicologo_nome",
  "psicologo_crp",
  "ip_paciente",
  "geo_paciente",
] as const;
export type CampoProibido = (typeof CAMPOS_PROIBIDOS)[number];

/* -------------------------------------------------------------------------- */
/*  Resposta padronizada do webhook (clínica entende sucesso vs. rejeição)    */
/* -------------------------------------------------------------------------- */
export const WebhookResposta = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("aceito"),
    evento_id: z.string(),
    recebido_em: z.string().datetime(),
  }),
  z.object({
    status: z.literal("rejeitado"),
    motivo: z.enum([
      "assinatura_invalida",
      "schema_invalido",
      "campos_proibidos",
      "k_anonymity_violado",
      "clinica_desconhecida",
      "duplicado",
      "rate_limit",
    ]),
    detalhe: z.string().optional(),
  }),
]);
export type WebhookResposta = z.infer<typeof WebhookResposta>;

/* -------------------------------------------------------------------------- */
/*  Helper: valida um payload e retorna um discriminated result.              */
/*  Use no handler: o tipo já vem refinado no caminho `ok`.                   */
/* -------------------------------------------------------------------------- */
export type ResultadoValidacao =
  | { ok: true; payload: SessaoFinalizadaPayload }
  | { ok: false; motivo: "schema_invalido" | "campos_proibidos"; erros: string[] };

export function validarPayload(input: unknown): ResultadoValidacao {
  // Camada 1: detecção explícita de campos proibidos (mensagem melhor pro DPO).
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const chavesEncontradas = Object.keys(input).filter((k) =>
      (CAMPOS_PROIBIDOS as readonly string[]).includes(k),
    );
    if (chavesEncontradas.length > 0) {
      return {
        ok: false,
        motivo: "campos_proibidos",
        erros: chavesEncontradas.map(
          (k) => `Campo "${k}" não pode atravessar a barreira de sigilo.`,
        ),
      };
    }
  }
  // Camada 2: Zod com `.strict()` rejeita qualquer outro extra.
  const parsed = SessaoFinalizadaPayload.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      motivo: "schema_invalido",
      erros: parsed.error.issues.map(
        (e) => `${e.path.join(".") || "<raiz>"}: ${e.message}`,
      ),
    };
  }
  return { ok: true, payload: parsed.data };
}
