import { describe, it, expect } from "vitest";
import { pctConformidade, estaConforme } from "@/lib/conformidade-ui";

describe("pctConformidade", () => {
  it("arredonda o percentual de itens OK", () => {
    expect(pctConformidade(1, 2)).toBe(50);
    expect(pctConformidade(2, 3)).toBe(67); // 66.66 → 67
    expect(pctConformidade(7, 7)).toBe(100);
    expect(pctConformidade(0, 7)).toBe(0);
  });

  it("retorna 0 (não NaN) com checklist vazio — banco novo", () => {
    expect(pctConformidade(0, 0)).toBe(0);
    expect(pctConformidade(5, 0)).toBe(0);
    expect(Number.isNaN(pctConformidade(0, 0))).toBe(false);
  });

  it("não estoura nem com total negativo (defensivo)", () => {
    expect(pctConformidade(1, -1)).toBe(0);
  });
});

describe("estaConforme", () => {
  it("é conforme só quando há itens e nenhum pendente/atenção", () => {
    expect(estaConforme(7, 0, 0)).toBe(true);
    expect(estaConforme(7, 1, 0)).toBe(false);
    expect(estaConforme(7, 0, 2)).toBe(false);
  });

  it("checklist vazio NÃO é conforme (falso-verde evitado)", () => {
    expect(estaConforme(0, 0, 0)).toBe(false);
  });
});
