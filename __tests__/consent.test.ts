import { describe, it, expect } from "vitest";
import {
  CONSENT_VERSION,
  parseConsentimento,
  consentiuAnalyticsDe,
  type Consentimento,
} from "@/lib/consent";

/**
 * Testes da lógica PURA de consentimento (sem DOM): parse do cookie/localStorage
 * e derivação de `consentiuAnalytics`. Cobre versão, ausência e lixo.
 */

function serializar(c: Partial<Consentimento>): string {
  return JSON.stringify(c);
}

describe("parseConsentimento", () => {
  it("retorna null quando ausente (null/undefined/vazio)", () => {
    expect(parseConsentimento(null)).toBeNull();
    expect(parseConsentimento(undefined)).toBeNull();
    expect(parseConsentimento("")).toBeNull();
  });

  it("retorna null para JSON inválido", () => {
    expect(parseConsentimento("{nao-e-json")).toBeNull();
    expect(parseConsentimento("garbage")).toBeNull();
  });

  it("retorna null para valores não-objeto", () => {
    expect(parseConsentimento("123")).toBeNull();
    expect(parseConsentimento('"string"')).toBeNull();
    expect(parseConsentimento("null")).toBeNull();
    expect(parseConsentimento("[]")).toBeNull();
  });

  it("retorna null quando a versão diverge (schema antigo/futuro)", () => {
    expect(
      parseConsentimento(serializar({ v: 0, analytics: true, ts: Date.now() })),
    ).toBeNull();
    expect(
      parseConsentimento(serializar({ v: 99, analytics: true, ts: Date.now() })),
    ).toBeNull();
  });

  it("retorna null quando analytics não é boolean", () => {
    expect(
      parseConsentimento(JSON.stringify({ v: CONSENT_VERSION, analytics: "sim", ts: 1 })),
    ).toBeNull();
    expect(
      parseConsentimento(JSON.stringify({ v: CONSENT_VERSION, ts: 1 })),
    ).toBeNull();
  });

  it("faz parse de um aceite válido (analytics=true)", () => {
    const ts = 1_700_000_000_000;
    const c = parseConsentimento(serializar({ v: CONSENT_VERSION, analytics: true, ts }));
    expect(c).toEqual({ v: CONSENT_VERSION, analytics: true, ts });
  });

  it("faz parse de uma recusa válida (analytics=false)", () => {
    const ts = 1_700_000_000_000;
    const c = parseConsentimento(serializar({ v: CONSENT_VERSION, analytics: false, ts }));
    expect(c).toEqual({ v: CONSENT_VERSION, analytics: false, ts });
  });

  it("normaliza ts ausente/inválido para 0 sem invalidar a decisão", () => {
    const c = parseConsentimento(JSON.stringify({ v: CONSENT_VERSION, analytics: true }));
    expect(c).toEqual({ v: CONSENT_VERSION, analytics: true, ts: 0 });

    const c2 = parseConsentimento(
      JSON.stringify({ v: CONSENT_VERSION, analytics: false, ts: "ontem" }),
    );
    expect(c2).toEqual({ v: CONSENT_VERSION, analytics: false, ts: 0 });
  });
});

describe("consentiuAnalyticsDe", () => {
  it("false quando não há decisão (null)", () => {
    expect(consentiuAnalyticsDe(null)).toBe(false);
  });

  it("true somente quando analytics === true", () => {
    expect(consentiuAnalyticsDe({ v: CONSENT_VERSION, analytics: true, ts: 1 })).toBe(true);
    expect(consentiuAnalyticsDe({ v: CONSENT_VERSION, analytics: false, ts: 1 })).toBe(false);
  });

  it("compõe com parseConsentimento ponta a ponta", () => {
    const aceite = serializar({ v: CONSENT_VERSION, analytics: true, ts: 1 });
    const recusa = serializar({ v: CONSENT_VERSION, analytics: false, ts: 1 });
    expect(consentiuAnalyticsDe(parseConsentimento(aceite))).toBe(true);
    expect(consentiuAnalyticsDe(parseConsentimento(recusa))).toBe(false);
    expect(consentiuAnalyticsDe(parseConsentimento(null))).toBe(false);
    expect(consentiuAnalyticsDe(parseConsentimento("lixo"))).toBe(false);
  });
});
