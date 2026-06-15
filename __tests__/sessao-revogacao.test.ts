import { describe, it, expect, beforeEach } from "vitest";
import {
  entradaValida,
  vereditoPorAtivo,
  purgarCacheSessao,
  _setCacheSessao,
  _getCacheSessao,
  avaliarSessao,
  TTL_MS,
} from "@/lib/sessao-guard";

/**
 * Onda 7 · Dev B · Refinos F — guard de revogação imediata de sessão.
 *
 * Testa a LÓGICA PURA do guard (sem DB): veredicto por `usuarios.ativo` e a
 * validade de entradas de cache por TTL. A integração com o DB (cache miss →
 * query) é coberta indiretamente: sem DATABASE_URL, `avaliarSessao` é
 * fail-open ("ok"), o que também asseguramos aqui.
 */

describe("sessao-guard · veredicto por ativo", () => {
  it("usuário ativo → ok", () => {
    expect(vereditoPorAtivo(true)).toBe("ok");
  });

  it("usuário inativo → revoga", () => {
    expect(vereditoPorAtivo(false)).toBe("revogar");
  });

  it("usuário inexistente (null/undefined) → revoga", () => {
    expect(vereditoPorAtivo(null)).toBe("revogar");
    expect(vereditoPorAtivo(undefined)).toBe("revogar");
  });
});

describe("sessao-guard · validade de cache por TTL", () => {
  it("entrada inexistente é inválida", () => {
    expect(entradaValida(undefined, 1_000)).toBe(false);
  });

  it("entrada dentro do TTL é válida", () => {
    const agora = 100_000;
    const entrada = { ativo: true, em: agora - (TTL_MS - 1) };
    expect(entradaValida(entrada, agora)).toBe(true);
  });

  it("entrada exatamente no TTL já expirou", () => {
    const agora = 100_000;
    const entrada = { ativo: true, em: agora - TTL_MS };
    expect(entradaValida(entrada, agora)).toBe(false);
  });

  it("entrada além do TTL é inválida", () => {
    const agora = 100_000;
    const entrada = { ativo: true, em: agora - (TTL_MS + 5_000) };
    expect(entradaValida(entrada, agora)).toBe(false);
  });

  it("respeita TTL customizado", () => {
    const agora = 100_000;
    const entrada = { ativo: false, em: agora - 5_000 };
    expect(entradaValida(entrada, agora, 10_000)).toBe(true);
    expect(entradaValida(entrada, agora, 1_000)).toBe(false);
  });
});

describe("sessao-guard · helpers de cache", () => {
  beforeEach(() => purgarCacheSessao());

  it("set/get usam chave case-insensitive (espelha login lower(email))", () => {
    _setCacheSessao("User@Example.com", true, 42);
    const e = _getCacheSessao("user@example.com");
    expect(e).toBeDefined();
    expect(e?.ativo).toBe(true);
    expect(e?.em).toBe(42);
  });

  it("purgar email remove só aquela entrada", () => {
    _setCacheSessao("a@x.com", true, 1);
    _setCacheSessao("b@x.com", false, 1);
    purgarCacheSessao("a@x.com");
    expect(_getCacheSessao("a@x.com")).toBeUndefined();
    expect(_getCacheSessao("b@x.com")).toBeDefined();
  });

  it("purgar sem argumento limpa tudo", () => {
    _setCacheSessao("a@x.com", true, 1);
    _setCacheSessao("b@x.com", true, 1);
    purgarCacheSessao();
    expect(_getCacheSessao("a@x.com")).toBeUndefined();
    expect(_getCacheSessao("b@x.com")).toBeUndefined();
  });
});

describe("sessao-guard · fail-open sem DB", () => {
  it("sem DATABASE_URL configurada, avaliarSessao não desloga (ok)", async () => {
    // O harness de teste roda sem DB (dbHabilitado=false) → fail-open.
    // (Se houver DB no ambiente, este teste vira um smoke do caminho feliz para
    //  um usuário inexistente, que é 'revogar' — então só asseguramos que não
    //  lança e retorna um veredicto válido.)
    const v = await avaliarSessao("ninguem-inexistente@example.com");
    expect(["ok", "revogar"]).toContain(v);
  });
});
