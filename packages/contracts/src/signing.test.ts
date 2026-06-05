import { describe, it, expect } from "vitest";
import {
  signPayload,
  verifySignature,
  verifyTimestamp,
  MAX_SKEW_SECONDS,
} from "@previa/contracts/signing";

const SECRET = "segredo-compartilhado-clinica";
const BODY = JSON.stringify({ evento: "sessao_finalizada", n: 42 });

describe("signPayload / verifySignature — HMAC SHA-256", () => {
  it("signPayload retorna formato sha256=<hex>", () => {
    const sig = signPayload(BODY, SECRET);
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("verifica assinatura correta", () => {
    const sig = signPayload(BODY, SECRET);
    expect(verifySignature(BODY, sig, SECRET)).toBe(true);
  });

  it("rejeita segredo errado", () => {
    const sig = signPayload(BODY, SECRET);
    expect(verifySignature(BODY, sig, "outro-segredo")).toBe(false);
  });

  it("rejeita corpo adulterado", () => {
    const sig = signPayload(BODY, SECRET);
    const corpoAdulterado = BODY + " ";
    expect(verifySignature(corpoAdulterado, sig, SECRET)).toBe(false);
  });

  it("rejeita header malformado (sem prefixo sha256=)", () => {
    expect(verifySignature(BODY, "deadbeef", SECRET)).toBe(false);
  });

  it("rejeita header nulo/indefinido", () => {
    expect(verifySignature(BODY, null, SECRET)).toBe(false);
    expect(verifySignature(BODY, undefined, SECRET)).toBe(false);
  });
});

describe("verifyTimestamp — anti-replay", () => {
  it("aceita timestamp atual (segundos)", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(verifyTimestamp(String(nowSeconds))).toBe(true);
  });

  it("rejeita timestamp antigo (now - 3600s)", () => {
    const agoraMs = Date.now();
    const velho = Math.floor(agoraMs / 1000) - 3600;
    expect(verifyTimestamp(String(velho), agoraMs)).toBe(false);
  });

  it("rejeita header ausente ou não-numérico", () => {
    expect(verifyTimestamp(null)).toBe(false);
    expect(verifyTimestamp("abc")).toBe(false);
  });

  it("aceita dentro da janela MAX_SKEW_SECONDS e rejeita logo além", () => {
    const agoraMs = Date.now();
    const dentro = Math.floor(agoraMs / 1000) - (MAX_SKEW_SECONDS - 1);
    const fora = Math.floor(agoraMs / 1000) - (MAX_SKEW_SECONDS + 1);
    expect(verifyTimestamp(String(dentro), agoraMs)).toBe(true);
    expect(verifyTimestamp(String(fora), agoraMs)).toBe(false);
  });
});
