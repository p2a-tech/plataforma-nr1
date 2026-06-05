import { describe, it, expect } from "vitest";
import {
  validarPayload,
  CAMPOS_PROIBIDOS,
  OFENSORES,
  OFENSORES_LABEL,
  K_MIN,
  type SessaoFinalizadaPayload,
} from "@previa/contracts";

/** Constrói um payload válido inline (sem campos proibidos, sem extras). */
function payloadValido(): Record<string, unknown> {
  const p: SessaoFinalizadaPayload = {
    session_id_anon: "a".repeat(32), // 32-hex
    clinica_id: "clinica-001",
    iniciada_em: "2026-06-04T10:00:00-03:00", // ISO 8601 com offset
    duracao_minutos: 30,
    cluster: { setor: "Enfermagem", turno: "noite", site: "Unidade Centro" },
    ofensores: [],
    severidade_estimada: "media",
    protocolo_emergencia_acionado: false,
    versao_extractor: "1.0.0",
  };
  return p as unknown as Record<string, unknown>;
}

describe("validarPayload — barreira de sigilo", () => {
  it("aceita um payload válido", () => {
    const res = validarPayload(payloadValido());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.clinica_id).toBe("clinica-001");
      expect(res.payload.cluster.turno).toBe("noite");
      // .default(false) aplicado pelo zod
      expect(res.payload.protocolo_emergencia_acionado).toBe(false);
    }
  });

  it("rejeita payload com campo proibido `transcript` (motivo campos_proibidos)", () => {
    const input = { ...payloadValido(), transcript: "conversa crua confidencial" };
    const res = validarPayload(input);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.motivo).toBe("campos_proibidos");
      expect(res.erros.length).toBeGreaterThan(0);
      expect(res.erros.join(" ")).toContain("transcript");
    }
  });

  it("rejeita payload com campo proibido `paciente_nome`", () => {
    const input = { ...payloadValido(), paciente_nome: "Maria" };
    const res = validarPayload(input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toBe("campos_proibidos");
  });

  it("rejeita campo extra desconhecido via .strict() (motivo schema_invalido)", () => {
    const input = { ...payloadValido(), campo_qualquer_inesperado: 123 };
    const res = validarPayload(input);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.motivo).toBe("schema_invalido");
      expect(res.erros.length).toBeGreaterThan(0);
    }
  });

  it("rejeita payload com session_id_anon inválido (não-hex) como schema_invalido", () => {
    const input = { ...payloadValido(), session_id_anon: "nao-é-hex!!!" };
    const res = validarPayload(input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toBe("schema_invalido");
  });

  it("a constante de k-anonimato é 7", () => {
    expect(K_MIN).toBe(7);
  });

  it("toda tag de OFENSORES tem um rótulo em OFENSORES_LABEL", () => {
    for (const tag of OFENSORES) {
      expect(OFENSORES_LABEL[tag]).toBeTypeOf("string");
      expect(OFENSORES_LABEL[tag].length).toBeGreaterThan(0);
    }
    // sem rótulos órfãos: mesma quantidade de chaves
    expect(Object.keys(OFENSORES_LABEL).length).toBe(OFENSORES.length);
  });

  it("CAMPOS_PROIBIDOS inclui os campos sensíveis canônicos", () => {
    expect(CAMPOS_PROIBIDOS).toContain("transcript");
    expect(CAMPOS_PROIBIDOS).toContain("paciente_nome");
    expect(CAMPOS_PROIBIDOS).toContain("cid");
  });
});
