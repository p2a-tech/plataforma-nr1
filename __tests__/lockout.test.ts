import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes de integração do lockout anti-brute-force (Onda 6 · D).
 *
 * Cobre: < LIMITE não bloqueia; >= LIMITE (7) em 15min bloqueia com Retry-After;
 * falhas fora da janela não contam; sucesso limpa as falhas; hash nunca grava
 * email/IP em claro.
 *
 * Exige Postgres local. Sem DATABASE_URL_ADMIN → skip.
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMAIL = "lockout.user@example.com";
const IP = "203.0.113.77";

describe.skipIf(!URL_ADMIN)("lockout · 7 falhas em 15min bloqueia; sucesso limpa", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let mod: typeof import("@/lib/login-lockout");
  let emailHash: string;
  let ipHash: string;

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });
    mod = await import("@/lib/login-lockout");
    emailHash = mod.hashLogin(EMAIL) as string;
    ipHash = mod.hashLogin(IP) as string;
  });

  afterAll(async () => {
    if (admin) {
      await admin`delete from public.login_attempts where email_hash = ${emailHash} or ip_hash = ${ipHash}`;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.login_attempts where email_hash = ${emailHash} or ip_hash = ${ipHash}`;
  });

  it("hashLogin nunca devolve o valor em claro", () => {
    expect(emailHash).not.toContain(EMAIL);
    expect(ipHash).not.toContain(IP);
    expect(emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(mod.hashLogin(null)).toBeNull();
    expect(mod.hashLogin(undefined)).toBeNull();
  });

  it("menos de 7 falhas → não bloqueia", async () => {
    for (let i = 0; i < 6; i++) {
      await mod.registrarTentativa(emailHash, ipHash, false);
    }
    const st = await mod.verificarLockout(emailHash, ipHash);
    expect(st.bloqueado).toBe(false);
    expect(st.falhas).toBe(6);
  });

  it("7 falhas em 15min → bloqueia com Retry-After", async () => {
    for (let i = 0; i < 7; i++) {
      await mod.registrarTentativa(emailHash, ipHash, false);
    }
    const st = await mod.verificarLockout(emailHash, ipHash);
    expect(st.bloqueado).toBe(true);
    expect(st.falhas).toBeGreaterThanOrEqual(7);
    expect(st.retryAfterS).toBeGreaterThan(0);
  });

  it("falhas fora da janela (>15min) não contam", async () => {
    // Insere 8 falhas antigas (20 min atrás).
    for (let i = 0; i < 8; i++) {
      await admin`
        insert into public.login_attempts (email_hash, ip_hash, sucesso, criado_em)
        values (${emailHash}, ${ipHash}, false, now() - interval '20 minutes')
      `;
    }
    const st = await mod.verificarLockout(emailHash, ipHash);
    expect(st.bloqueado).toBe(false);
    expect(st.falhas).toBe(0);
  });

  it("bloqueio dispara por email OU por IP (independentes)", async () => {
    // 7 falhas só pelo IP (email_hash null).
    for (let i = 0; i < 7; i++) {
      await mod.registrarTentativa(null, ipHash, false);
    }
    // Um email diferente, mesmo IP → ainda bloqueado pelo IP.
    const outroEmailHash = mod.hashLogin("outro@example.com") as string;
    const st = await mod.verificarLockout(outroEmailHash, ipHash);
    expect(st.bloqueado).toBe(true);

    await admin`delete from public.login_attempts where email_hash = ${outroEmailHash}`;
  });

  it("sucesso limpa as falhas recentes do email", async () => {
    for (let i = 0; i < 7; i++) {
      await mod.registrarTentativa(emailHash, ipHash, false);
    }
    expect((await mod.verificarLockout(emailHash, null)).bloqueado).toBe(true);

    await mod.limparFalhas(emailHash);

    const st = await mod.verificarLockout(emailHash, null);
    expect(st.bloqueado).toBe(false);
    expect(st.falhas).toBe(0);
  });
});
