import { describe, it, expect } from "vitest";
import { hashConteudo, selarAssinatura, seloValido } from "./pgr";

describe("hashConteudo — hash determinístico canônico", () => {
  it("mesmo objeto → mesmo hash", () => {
    const obj = { riscos: ["a", "b"], conformidade: 0.8 };
    expect(hashConteudo(obj)).toBe(hashConteudo(obj));
  });

  it("independente da ordem das chaves → mesmo hash", () => {
    const a = { setor: "x", turno: "noite", n: 9 };
    const b = { n: 9, turno: "noite", setor: "x" };
    expect(hashConteudo(a)).toBe(hashConteudo(b));
  });

  it("ordem de chaves aninhadas também não afeta o hash", () => {
    const a = { meta: { z: 1, a: 2 }, lista: [{ k: 1, j: 2 }] };
    const b = { lista: [{ j: 2, k: 1 }], meta: { a: 2, z: 1 } };
    expect(hashConteudo(a)).toBe(hashConteudo(b));
  });

  it("conteúdo diferente → hash diferente", () => {
    expect(hashConteudo({ n: 1 })).not.toBe(hashConteudo({ n: 2 }));
  });

  it("retorna um sha256 hex de 64 chars", () => {
    expect(hashConteudo({ x: 1 })).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("selarAssinatura / seloValido — selo HMAC tamper-evident", () => {
  const parts = {
    hash: "a".repeat(64),
    nome: "Dra. Responsável",
    papel: "Médica do Trabalho",
    ts: "2026-06-04T12:00:00.000Z",
  };

  it("selo recém-gerado é válido para os mesmos parts", () => {
    const selo = selarAssinatura(parts);
    expect(seloValido(selo, parts)).toBe(true);
  });

  it("selo deixa de valer se qualquer campo muda", () => {
    const selo = selarAssinatura(parts);
    expect(seloValido(selo, { ...parts, hash: "b".repeat(64) })).toBe(false);
    expect(seloValido(selo, { ...parts, nome: "Outro" })).toBe(false);
    expect(seloValido(selo, { ...parts, papel: "Outro Papel" })).toBe(false);
    expect(seloValido(selo, { ...parts, ts: "2026-06-04T12:00:01.000Z" })).toBe(
      false,
    );
  });

  it("selo arbitrário/forjado não confere", () => {
    expect(seloValido("deadbeef", parts)).toBe(false);
  });
});
