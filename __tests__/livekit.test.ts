import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Testes do adapter LiveKit (lib/livekit.ts) — teleconsulta (Onda 7 · Dev C).
 *
 * NÃO testa WebRTC real. Foca no que importa para a barreira/degradação:
 *   1. `criarTokenSala` gera um JWT válido (3 segmentos, header HS256) quando
 *      LIVEKIT_* está configurado (chaves FAKE via env).
 *   2. `liveKitConfigurado` reflete corretamente presença/ausência das envs.
 *   3. No-op/erro claro: sem config, `criarTokenSala` lança e
 *      `liveKitConfigurado` é false.
 *
 * Como lib/livekit.ts lê as envs no carregamento do módulo, controlamos o estado
 * com vi.resetModules() + import() dinâmico por cenário.
 */

const ENV_KEYS = [
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_URL",
  "LIVEKIT_TOKEN_TTL",
] as const;

const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) original[k] = process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
  vi.resetModules();
});

function setConfigurado() {
  process.env.LIVEKIT_API_KEY = "devkey-fake";
  process.env.LIVEKIT_API_SECRET = "devsecret-fake-0123456789abcdef";
  process.env.LIVEKIT_URL = "wss://example.livekit.cloud";
}

function setNaoConfigurado() {
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;
  delete process.env.LIVEKIT_URL;
}

/** Decodifica o header (1º segmento) de um JWT compacto. */
function decodeJwtHeader(jwt: string): Record<string, unknown> {
  const seg = jwt.split(".")[0];
  const json = Buffer.from(seg, "base64url").toString("utf8");
  return JSON.parse(json);
}

/** Decodifica o payload (2º segmento) de um JWT compacto. */
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const seg = jwt.split(".")[1];
  const json = Buffer.from(seg, "base64url").toString("utf8");
  return JSON.parse(json);
}

describe("liveKitConfigurado", () => {
  it("é true quando as três variáveis estão presentes", async () => {
    setConfigurado();
    const mod = await import("@/lib/livekit");
    expect(mod.liveKitConfigurado).toBe(true);
  });

  it("é false quando faltam variáveis", async () => {
    setNaoConfigurado();
    const mod = await import("@/lib/livekit");
    expect(mod.liveKitConfigurado).toBe(false);
  });

  it("é false se só uma das três estiver setada", async () => {
    setNaoConfigurado();
    process.env.LIVEKIT_API_KEY = "só-a-key";
    const mod = await import("@/lib/livekit");
    expect(mod.liveKitConfigurado).toBe(false);
  });
});

describe("criarTokenSala — configurado", () => {
  beforeEach(() => setConfigurado());

  it("gera um JWT válido (3 segmentos, alg HS256)", async () => {
    const { criarTokenSala } = await import("@/lib/livekit");
    const jwt = await criarTokenSala({
      sala: "tc-abc123",
      identidade: "psi-clinica-1",
      nome: "Psicólogo(a)",
      podePublicar: true,
    });

    expect(typeof jwt).toBe("string");
    expect(jwt.split(".")).toHaveLength(3);

    const header = decodeJwtHeader(jwt);
    expect(header.alg).toBe("HS256");
  });

  it("embute a sala e a identidade no grant do token", async () => {
    const { criarTokenSala } = await import("@/lib/livekit");
    const jwt = await criarTokenSala({
      sala: "tc-deadbeef",
      identidade: "psi-xyz",
      nome: "Dra. Teste",
      podePublicar: true,
    });

    const payload = decodeJwtPayload(jwt);
    // O LiveKit põe a identidade em `sub` e os grants em `video`.
    expect(payload.sub).toBe("psi-xyz");
    const video = payload.video as Record<string, unknown> | undefined;
    expect(video).toBeTruthy();
    expect(video?.room).toBe("tc-deadbeef");
    expect(video?.roomJoin).toBe(true);
    expect(video?.canPublish).toBe(true);
  });

  it("respeita podePublicar=false (convidado observador)", async () => {
    const { criarTokenSala } = await import("@/lib/livekit");
    const jwt = await criarTokenSala({
      sala: "tc-obs",
      identidade: "obs-1",
      podePublicar: false,
    });
    const payload = decodeJwtPayload(jwt);
    const video = payload.video as Record<string, unknown>;
    expect(video.canPublish).toBe(false);
    // Convidado nunca administra a sala.
    expect(video.roomAdmin).toBeFalsy();
  });
});

describe("criarTokenSala — não configurado", () => {
  beforeEach(() => setNaoConfigurado());

  it("lança erro claro quando LIVEKIT_* está ausente (fail-closed)", async () => {
    const { criarTokenSala } = await import("@/lib/livekit");
    await expect(
      criarTokenSala({ sala: "tc-x", identidade: "u1" }),
    ).rejects.toThrow(/não configurada/i);
  });
});

describe("novaSalaAnonima", () => {
  it("gera nome anônimo no formato tc-<hex> sem PII", async () => {
    setConfigurado();
    const { novaSalaAnonima } = await import("@/lib/livekit");
    const a = novaSalaAnonima();
    const b = novaSalaAnonima();
    expect(a).toMatch(/^tc-[0-9a-f]{16}$/);
    expect(b).toMatch(/^tc-[0-9a-f]{16}$/);
    expect(a).not.toBe(b); // imprevisível/único
  });
});
