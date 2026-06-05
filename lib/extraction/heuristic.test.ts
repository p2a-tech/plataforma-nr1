import { describe, it, expect } from "vitest";
import { analisarHeuristico } from "./heuristic";

describe("analisarHeuristico — extrator heurístico", () => {
  it("detecta ofensores relevantes em transcrição com sobrecarga, turno da noite e supervisor grosseiro", () => {
    const transcricao =
      "Estou com muita sobrecarga ultimamente. Trabalho no turno da noite e " +
      "meu supervisor é grosseiro comigo o tempo todo.";
    const res = analisarHeuristico(transcricao);

    const tags = res.ofensores.map((o) => o.tag);
    expect(tags).toContain("sobrecarga_trabalho");
    expect(tags).toContain("jornada_descanso_insuficiente"); // "turno da noite"
    expect(tags).toContain("conflito_lideranca"); // "supervisor" + "grosseiro"

    expect(res.severidade).not.toBe("baixa");
    expect(res.engine).toBe("heuristico");
    // cada ofensor traz confiança 0-1 e ao menos uma ocorrência
    for (const o of res.ofensores) {
      expect(o.confidence).toBeGreaterThan(0);
      expect(o.confidence).toBeLessThanOrEqual(1);
      expect(o.ocorrencias).toBeGreaterThanOrEqual(1);
    }
  });

  it("transcrição limpa/vazia não produz ofensores", () => {
    const vazio = analisarHeuristico("");
    expect(vazio.ofensores).toHaveLength(0);
    expect(vazio.severidade).toBe("baixa");
    expect(vazio.riscoGrave).toBe(false);

    const limpo = analisarHeuristico(
      "Tudo tranquilo hoje, conversamos sobre o fim de semana e o tempo.",
    );
    expect(limpo.ofensores).toHaveLength(0);
    expect(limpo.riscoGrave).toBe(false);
  });

  it("levanta riscoGrave em frase de risco grave do léxico", () => {
    // "não quero mais viver" consta em SINAIS_RISCO_GRAVE
    const res = analisarHeuristico("Às vezes sinto que não quero mais viver.");
    expect(res.riscoGrave).toBe(true);
    // deve aparecer a nota de risco grave
    expect(res.notas.some((n) => /risco grave/i.test(n.topico))).toBe(true);
  });

  it("é determinístico: mesmo texto → mesmo resultado", () => {
    const t = "Sobrecarga e pressão por metas, sem folga.";
    expect(JSON.stringify(analisarHeuristico(t))).toBe(
      JSON.stringify(analisarHeuristico(t)),
    );
  });
});
