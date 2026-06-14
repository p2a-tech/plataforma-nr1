import { describe, it, expect } from "vitest";
import {
  calcularEscorePorColaborador,
  classificar,
  validarAmostra,
  normalizarItemDRPS,
  type ItemRespostaDRPS,
} from "@/lib/drps-escoragem";

/**
 * Testes da escoragem DRPS (Onda 4, Dev B · §3 BACKLOG_OKEBAMBO).
 *
 * Cobre os 4 casos exigidos pelo brief:
 *   1. Cenário BAIXO (respostas boas → score perto de 1)
 *   2. Cenário MODERADO (respostas médias → score 2.1-3.5)
 *   3. Cenário ALTO (respostas ruins → score > 3.5)
 *   4. k-anonimato falha (< 7 respostas)
 *
 * Lembrete da convenção: na PrevIA, "score 1 = baixo risco / score 5 = alto
 * risco". O instrumento Okêbambo inverte (Nunca=5=bom, Sempre=1=bom também
 * dependendo da pergunta), então `normalizarItemDRPS` cuida do mapeamento.
 */

/**
 * Helper: monta um conjunto de respostas Likert 1-5 inversas (Q5-Q10, Q13-Q16
 * do instrumento Okêbambo) com o mesmo valor — para simular cenários
 * homogêneos sem precisar enumerar 10 perguntas.
 */
function respostasLikertHomogeneas(valor: number, n: number = 10): ItemRespostaDRPS[] {
  return Array.from({ length: n }, () => ({
    tipo: "likert5_inverso" as const,
    valor_int: valor,
    peso: 1,
  }));
}

describe("normalizarItemDRPS — semântica de cada tipo", () => {
  it("likert5_inverso (Q5-Q16): Sempre=1 → 1 (baixo risco), Nunca=5 → 5 (alto risco)", () => {
    // Perguntas positivamente formuladas. "Sempre consigo" = bom = score 1.
    // "Nunca consigo" = ruim = score 5. Já bate com a convenção PrevIA.
    expect(normalizarItemDRPS({ tipo: "likert5_inverso", valor_int: 1 })).toBe(1);
    expect(normalizarItemDRPS({ tipo: "likert5_inverso", valor_int: 5 })).toBe(5);
  });

  it("likert3_freq: Raramente=1 → score baixo, Frequentemente=3 → score alto", () => {
    // Q11/Q12 são "Com que frequência você sente esgotamento?"
    // Raramente=1 = bom (baixo risco). Frequentemente=3 = ruim (alto risco).
    expect(normalizarItemDRPS({ tipo: "likert3_freq", valor_int: 1 })).toBe(1);
    expect(normalizarItemDRPS({ tipo: "likert3_freq", valor_int: 2 })).toBe(3);
    expect(normalizarItemDRPS({ tipo: "likert3_freq", valor_int: 3 })).toBe(5);
  });

  it("escala_impacto (Q17): 1=Não → 1 (baixo), 4=Significativamente → 5 (alto)", () => {
    expect(normalizarItemDRPS({ tipo: "escala_impacto", valor_int: 1 })).toBe(1);
    expect(normalizarItemDRPS({ tipo: "escala_impacto", valor_int: 4 })).toBe(5);
  });

  it("escala_esgotamento (Q18): 1=Nunca → 1, 5=Sempre → 5 (já alinhada)", () => {
    expect(normalizarItemDRPS({ tipo: "escala_esgotamento", valor_int: 1 })).toBe(1);
    expect(normalizarItemDRPS({ tipo: "escala_esgotamento", valor_int: 5 })).toBe(5);
  });

  it("tipos não pesáveis (demografico, texto_livre, multi_choice) retornam null", () => {
    expect(normalizarItemDRPS({ tipo: "demografico", valor_int: 3 })).toBeNull();
    expect(normalizarItemDRPS({ tipo: "texto_livre", valor_int: null })).toBeNull();
    expect(normalizarItemDRPS({ tipo: "multi_choice", valor_int: 1 })).toBeNull();
  });

  it("valor_int fora de faixa retorna null (defesa em profundidade)", () => {
    expect(normalizarItemDRPS({ tipo: "likert5_inverso", valor_int: 6 })).toBeNull();
    expect(normalizarItemDRPS({ tipo: "likert3_freq", valor_int: 0 })).toBeNull();
    expect(normalizarItemDRPS({ tipo: "escala_impacto", valor_int: 5 })).toBeNull();
  });
});

describe("calcularEscorePorColaborador — agregação", () => {
  it("cenário BAIXO: respondente consistentemente 'positivo' (Sempre=1)", () => {
    const items: ItemRespostaDRPS[] = respostasLikertHomogeneas(1);
    const r = calcularEscorePorColaborador(items);
    expect(r.media).toBe(1);
    expect(r.completude).toBe(1);
    expect(r.valido).toBe(true);
    expect(classificar(r.media)).toBe("baixo");
  });

  it("cenário MODERADO: respondente intermediário (valor=3)", () => {
    const items: ItemRespostaDRPS[] = respostasLikertHomogeneas(3);
    const r = calcularEscorePorColaborador(items);
    expect(r.media).toBe(3);
    expect(classificar(r.media)).toBe("moderado");
  });

  it("cenário ALTO: respondente 'negativo' (Nunca=5 — nunca tem suporte)", () => {
    const items: ItemRespostaDRPS[] = respostasLikertHomogeneas(5);
    const r = calcularEscorePorColaborador(items);
    expect(r.media).toBe(5);
    expect(classificar(r.media)).toBe("alto");
  });

  it("completude < 70% marca a resposta como inválida", () => {
    const items: ItemRespostaDRPS[] = [
      ...respostasLikertHomogeneas(3, 3),
      ...Array.from({ length: 7 }, () => ({
        tipo: "likert5_inverso" as const,
        valor_int: null,
        peso: 1,
      })),
    ];
    const r = calcularEscorePorColaborador(items);
    expect(r.completude).toBeCloseTo(0.3, 1);
    expect(r.valido).toBe(false);
  });

  it("pesos diferentes mudam a média ponderada", () => {
    const items: ItemRespostaDRPS[] = [
      { tipo: "likert5_inverso", valor_int: 1, peso: 1 },
      { tipo: "likert5_inverso", valor_int: 5, peso: 3 },
    ];
    // (1*1 + 5*3) / (1+3) = 16/4 = 4
    const r = calcularEscorePorColaborador(items);
    expect(r.media).toBe(4);
    expect(classificar(r.media)).toBe("alto");
  });

  it("respostas combinando tipos (likert5 + likert3 + escala_esgotamento)", () => {
    const items: ItemRespostaDRPS[] = [
      { tipo: "likert5_inverso", valor_int: 4, peso: 1 }, // → 4
      { tipo: "likert3_freq", valor_int: 2, peso: 1 }, // → 3
      { tipo: "escala_esgotamento", valor_int: 4, peso: 1 }, // → 4
    ];
    // média = (4+3+4)/3 = 3.667
    const r = calcularEscorePorColaborador(items);
    expect(r.media).toBeCloseTo(3.667, 2);
    expect(classificar(r.media)).toBe("alto");
  });
});

describe("classificar — fronteiras do BACKLOG §3", () => {
  it("score 2.0 → baixo (limite inclusivo)", () => {
    expect(classificar(2.0)).toBe("baixo");
  });
  it("score 2.1 → moderado", () => {
    expect(classificar(2.1)).toBe("moderado");
  });
  it("score 3.5 → moderado (limite inclusivo)", () => {
    expect(classificar(3.5)).toBe("moderado");
  });
  it("score 3.51 → alto", () => {
    expect(classificar(3.51)).toBe("alto");
  });
  it("NaN é tratado como baixo (fail-safe)", () => {
    expect(classificar(Number.NaN)).toBe("baixo");
  });
});

describe("validarAmostra — k-anonimato (n ≥ 7)", () => {
  it("n=6 → falha (k_anonimato)", () => {
    const r = validarAmostra(6);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("k_anonimato");
    expect(r.minimo).toBe(7);
  });

  it("n=7 → ok", () => {
    expect(validarAmostra(7).ok).toBe(true);
  });

  it("n=100 → ok", () => {
    expect(validarAmostra(100).ok).toBe(true);
  });

  it("n=0 → falha", () => {
    expect(validarAmostra(0).ok).toBe(false);
  });
});
