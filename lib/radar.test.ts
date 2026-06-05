import { describe, it, expect } from "vitest";
import { energiaParaRisco, PulsoResposta, ENERGIA_OPCOES, K_MIN } from "./radar";

describe("energiaParaRisco — energia 1-5 → risco 0-100", () => {
  it("energia 5 (ótima) → risco 0", () => {
    expect(energiaParaRisco(5)).toBe(0);
  });

  it("energia 1 (no limite) → risco 100", () => {
    expect(energiaParaRisco(1)).toBe(100);
  });

  it("energia 3 (intermediária) → risco 50", () => {
    expect(energiaParaRisco(3)).toBe(50);
  });

  it("monotonicamente: quanto menor a energia, maior o risco", () => {
    expect(energiaParaRisco(4)).toBeLessThan(energiaParaRisco(2));
  });
});

describe("PulsoResposta — schema .strict()", () => {
  const pulsoValido = {
    empresa_id: "emp_translog",
    cluster_setor: "Logística",
    cluster_turno: "tarde" as const,
    energia: 4,
  };

  it("aceita um pulso válido (aplicando default de canal)", () => {
    const r = PulsoResposta.safeParse(pulsoValido);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.canal).toBe("whatsapp");
  });

  it("rejeita energia fora da faixa (6)", () => {
    const r = PulsoResposta.safeParse({ ...pulsoValido, energia: 6 });
    expect(r.success).toBe(false);
  });

  it("rejeita campo extra desconhecido (.strict)", () => {
    const r = PulsoResposta.safeParse({ ...pulsoValido, campo_extra: "x" });
    expect(r.success).toBe(false);
  });

  it("rejeita cluster_turno inválido", () => {
    const r = PulsoResposta.safeParse({ ...pulsoValido, cluster_turno: "vespertino" });
    expect(r.success).toBe(false);
  });
});

describe("constantes do radar", () => {
  it("K_MIN reexportado é 7", () => {
    expect(K_MIN).toBe(7);
  });

  it("ENERGIA_OPCOES cobre os valores 1..5", () => {
    expect(ENERGIA_OPCOES.map((o) => o.valor).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
