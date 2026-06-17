import { describe, it, expect } from "vitest";
import {
  RISCOS_OCUPACIONAIS,
  todos,
  listarPorCategoria,
  riscoPorKey,
  type RiscoOcupacionalCatalogo,
} from "@/lib/catalogo-riscos-ocupacionais";

/**
 * Testes do catálogo estático de riscos ocupacionais físicos/ergonômicos
 * (Onda 8 · Dev B). Catálogo puro, sem DB — roda sempre.
 */

describe("catálogo de riscos ocupacionais", () => {
  it("tem itens físicos e ergonômicos", () => {
    const fisicos = listarPorCategoria("fisico");
    const ergonomicos = listarPorCategoria("ergonomico");
    expect(fisicos.length).toBeGreaterThan(0);
    expect(ergonomicos.length).toBeGreaterThan(0);
    // ~8 a 12 itens no total
    expect(RISCOS_OCUPACIONAIS.length).toBeGreaterThanOrEqual(8);
    expect(RISCOS_OCUPACIONAIS.length).toBeLessThanOrEqual(12);
  });

  it("listarPorCategoria filtra corretamente por categoria", () => {
    for (const r of listarPorCategoria("fisico")) {
      expect(r.categoria).toBe("fisico");
    }
    for (const r of listarPorCategoria("ergonomico")) {
      expect(r.categoria).toBe("ergonomico");
    }
    // A soma das duas categorias cobre todos os itens (só há essas duas).
    const soma = listarPorCategoria("fisico").length + listarPorCategoria("ergonomico").length;
    expect(soma).toBe(RISCOS_OCUPACIONAIS.length);
  });

  it("todo item tem risco, fonte e consequência não vazios", () => {
    for (const r of RISCOS_OCUPACIONAIS) {
      expect(r.risco.trim().length).toBeGreaterThan(0);
      expect(r.fonte.trim().length).toBeGreaterThan(0);
      expect(r.consequencia.trim().length).toBeGreaterThan(0);
      expect(["fisico", "ergonomico"]).toContain(r.categoria);
    }
  });

  it("todas as keys são únicas", () => {
    const keys = RISCOS_OCUPACIONAIS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("não há nomes de risco duplicados (case-insensitive) dentro da mesma categoria", () => {
    for (const cat of ["fisico", "ergonomico"] as const) {
      const nomes = listarPorCategoria(cat).map((r) => r.risco.trim().toLowerCase());
      expect(new Set(nomes).size).toBe(nomes.length);
    }
  });

  it("todos() devolve cópia (não a mesma referência do array fonte)", () => {
    const copia = todos();
    expect(copia).toEqual(RISCOS_OCUPACIONAIS);
    expect(copia).not.toBe(RISCOS_OCUPACIONAIS);
  });

  it("riscoPorKey encontra item existente e devolve undefined para inexistente", () => {
    const primeiro: RiscoOcupacionalCatalogo = RISCOS_OCUPACIONAIS[0];
    expect(riscoPorKey(primeiro.key)).toEqual(primeiro);
    expect(riscoPorKey("key-que-nao-existe")).toBeUndefined();
  });

  it("contém riscos típicos esperados (ruído e postura/esforço)", () => {
    const fisicosNomes = listarPorCategoria("fisico")
      .map((r) => r.risco.toLowerCase())
      .join(" | ");
    const ergoNomes = listarPorCategoria("ergonomico")
      .map((r) => r.risco.toLowerCase())
      .join(" | ");
    expect(fisicosNomes).toMatch(/ruído|iluminação|temperatura|biológic/);
    expect(ergoNomes).toMatch(/postura|esforço|mobiliário|levantamento/);
  });
});
