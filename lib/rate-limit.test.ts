import { describe, it, expect, beforeEach } from "vitest";
import {
  rateLimit,
  clientIp,
  rateLimitKey,
  __resetRateLimitStore,
} from "./rate-limit";

beforeEach(() => {
  __resetRateLimitStore();
});

describe("rateLimit — janela fixa", () => {
  it("permite até `limit` requisições e bloqueia a seguinte", () => {
    const opts = { limit: 3, windowMs: 1_000 };
    const now = 1_000_000;

    // 3 requisições dentro do limite.
    expect(rateLimit("k", opts, now).ok).toBe(true);
    expect(rateLimit("k", opts, now).ok).toBe(true);
    expect(rateLimit("k", opts, now).ok).toBe(true);

    // 4ª estoura o limite.
    const quarta = rateLimit("k", opts, now);
    expect(quarta.ok).toBe(false);
    expect(quarta.remaining).toBe(0);
    expect(quarta.retryAfterMs).toBeGreaterThan(0);
  });

  it("decrementa `remaining` até 0", () => {
    const opts = { limit: 3, windowMs: 1_000 };
    const now = 1_000_000;

    expect(rateLimit("k", opts, now).remaining).toBe(2);
    expect(rateLimit("k", opts, now).remaining).toBe(1);
    expect(rateLimit("k", opts, now).remaining).toBe(0);
    // Já bloqueado, mas remaining permanece em 0 (não fica negativo).
    expect(rateLimit("k", opts, now).remaining).toBe(0);
  });

  it("retryAfterMs reflete o tempo restante até o reset quando bloqueado", () => {
    const opts = { limit: 1, windowMs: 5_000 };
    const inicio = 2_000_000;

    // Primeira chamada cria a janela: resetAt = inicio + 5_000.
    expect(rateLimit("k", opts, inicio).ok).toBe(true);

    // Segunda chamada, 1_500ms depois, é bloqueada: faltam 3_500ms.
    const bloqueada = rateLimit("k", opts, inicio + 1_500);
    expect(bloqueada.ok).toBe(false);
    expect(bloqueada.retryAfterMs).toBe(3_500);
  });

  it("ok=true tem retryAfterMs 0", () => {
    const r = rateLimit("k", { limit: 5, windowMs: 1_000 }, 3_000_000);
    expect(r.ok).toBe(true);
    expect(r.retryAfterMs).toBe(0);
  });

  it("reinicia a janela depois de `windowMs` (relógio injetado)", () => {
    const opts = { limit: 2, windowMs: 1_000 };
    const t0 = 5_000_000;

    // Esgota a janela em t0.
    expect(rateLimit("k", opts, t0).ok).toBe(true);
    expect(rateLimit("k", opts, t0).ok).toBe(true);
    expect(rateLimit("k", opts, t0).ok).toBe(false);

    // Ainda dentro da janela (t0 + 999ms): continua bloqueado.
    expect(rateLimit("k", opts, t0 + 999).ok).toBe(false);

    // Passou a janela (t0 + 1_001ms > resetAt): reinicia e permite de novo.
    const aposReset = rateLimit("k", opts, t0 + 1_001);
    expect(aposReset.ok).toBe(true);
    expect(aposReset.remaining).toBe(1);
  });

  it("trata chaves diferentes de forma independente", () => {
    const opts = { limit: 1, windowMs: 1_000 };
    const now = 6_000_000;

    expect(rateLimit("a", opts, now).ok).toBe(true);
    // "a" já estourou…
    expect(rateLimit("a", opts, now).ok).toBe(false);
    // …mas "b" tem sua própria janela.
    expect(rateLimit("b", opts, now).ok).toBe(true);
  });

  it("usa Date.now() por padrão quando `now` não é informado", () => {
    const r = rateLimit("default-clock", { limit: 1, windowMs: 10_000 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(0);
  });
});

describe("clientIp", () => {
  function reqCom(headers: Record<string, string>): { headers: Headers } {
    return { headers: new Headers(headers) };
  }

  it("usa o primeiro IP de x-forwarded-for", () => {
    const req = reqCom({
      "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178",
    });
    expect(clientIp(req)).toBe("203.0.113.7");
  });

  it("apara espaços ao redor do primeiro IP", () => {
    const req = reqCom({ "x-forwarded-for": "  198.51.100.9 , 10.0.0.1 " });
    expect(clientIp(req)).toBe("198.51.100.9");
  });

  it("cai para x-real-ip quando x-forwarded-for está ausente", () => {
    const req = reqCom({ "x-real-ip": "192.0.2.44" });
    expect(clientIp(req)).toBe("192.0.2.44");
  });

  it("retorna 'unknown' quando nenhum cabeçalho de IP está presente", () => {
    expect(clientIp(reqCom({}))).toBe("unknown");
  });

  it("retorna 'unknown' quando x-forwarded-for está vazio", () => {
    expect(clientIp(reqCom({ "x-forwarded-for": "" }))).toBe("unknown");
  });
});

describe("rateLimitKey", () => {
  it("junta partes não-vazias com ':'", () => {
    expect(rateLimitKey(["pulso", "clinica-42", "203.0.113.7"])).toBe(
      "pulso:clinica-42:203.0.113.7",
    );
  });

  it("descarta null, undefined e strings vazias/só-espaço", () => {
    expect(rateLimitKey(["pulso", null, undefined, "", "   ", "ip"])).toBe(
      "pulso:ip",
    );
  });

  it("apara as partes antes de juntar", () => {
    expect(rateLimitKey(["  a  ", " b "])).toBe("a:b");
  });

  it("retorna string vazia quando não há partes válidas", () => {
    expect(rateLimitKey([null, undefined, "  "])).toBe("");
  });
});
