import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import bcrypt from "bcryptjs";

/**
 * Testes de integração do reset de senha (Onda 6 · D).
 *
 * Cobre: geração de token, validação/uso (troca a senha), expiração, uso único
 * (token usado não vale de novo) e força mínima (>=8).
 *
 * Exige Postgres local. Sem DATABASE_URL_ADMIN → skip.
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMP = "emp_test_reset";
const EMAIL = "reset.user@example.com";
const SENHA_ORIG = "senhaOriginal1";

describe.skipIf(!URL_ADMIN)("auth-reset · token gera/valida/expira/uso único", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let solicitarReset: typeof import("@/lib/auth-reset")["solicitarReset"];
  let confirmarReset: typeof import("@/lib/auth-reset")["confirmarReset"];
  let hashToken: typeof import("@/lib/auth-reset")["hashToken"];

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });
    await admin`insert into public.empresas (id, nome) values (${EMP}, 'Reset Test')
                on conflict (id) do nothing`;
    const mod = await import("@/lib/auth-reset");
    solicitarReset = mod.solicitarReset;
    confirmarReset = mod.confirmarReset;
    hashToken = mod.hashToken;
  });

  afterAll(async () => {
    if (admin) {
      await admin`delete from public.password_reset_tokens where usuario_email = ${EMAIL}`;
      await admin`delete from public.usuarios where email = ${EMAIL}`;
      await admin`delete from public.empresas where id = ${EMP}`;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.password_reset_tokens where usuario_email = ${EMAIL}`;
    await admin`delete from public.usuarios where email = ${EMAIL}`;
    await admin`
      insert into public.usuarios (email, senha_hash, papel, empresa_id, clinica_id)
      values (${EMAIL}, ${bcrypt.hashSync(SENHA_ORIG, 10)}, 'sst', ${EMP}, null)
    `;
  });

  it("e-mail inexistente → token null (não vaza), nada gravado", async () => {
    const r = await solicitarReset("naoexiste@example.com");
    expect(r.token).toBeNull();
    expect(r.email).toBeNull();
  });

  it("gera token e confirma troca de senha (uso único)", async () => {
    const sol = await solicitarReset(EMAIL);
    expect(sol.token).not.toBeNull();
    expect(sol.email).toBe(EMAIL);

    // Token persistido como hash (nunca cru).
    const [tk] = await admin`
      select token_hash, usado_em from public.password_reset_tokens where usuario_email = ${EMAIL}
    `;
    expect(tk.token_hash).toBe(hashToken(sol.token!));
    expect(tk.usado_em).toBeNull();

    // Confirma com nova senha.
    const novaSenha = "novaSenhaForte9";
    const conf = await confirmarReset(sol.token!, novaSenha);
    expect(conf.ok).toBe(true);

    // Senha trocada no banco.
    const [u] = await admin`select senha_hash from public.usuarios where email = ${EMAIL}`;
    expect(bcrypt.compareSync(novaSenha, u.senha_hash)).toBe(true);
    expect(bcrypt.compareSync(SENHA_ORIG, u.senha_hash)).toBe(false);

    // Uso único: reusar o mesmo token falha.
    const reuso = await confirmarReset(sol.token!, "outraSenha123");
    expect(reuso.ok).toBe(false);
    if (!reuso.ok) expect(reuso.motivo).toBe("token_invalido");
  });

  it("token expirado é rejeitado", async () => {
    const sol = await solicitarReset(EMAIL);
    expect(sol.token).not.toBeNull();
    // Força expiração no passado.
    await admin`
      update public.password_reset_tokens
         set expira_em = now() - interval '1 minute'
       where usuario_email = ${EMAIL}
    `;
    const r = await confirmarReset(sol.token!, "qualquerSenha8");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("token_invalido");
  });

  it("senha fraca (<8) é rejeitada antes de tocar o token", async () => {
    const sol = await solicitarReset(EMAIL);
    const r = await confirmarReset(sol.token!, "curta");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("senha_fraca");

    // Token continua válido (não foi consumido).
    const [tk] = await admin`
      select usado_em from public.password_reset_tokens where usuario_email = ${EMAIL}
    `;
    expect(tk.usado_em).toBeNull();
  });

  it("token inválido (não existe) é rejeitado", async () => {
    const r = await confirmarReset("token-que-nao-existe-aaaaaaaaaa", "senhaValida8");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("token_invalido");
  });

  it("solicitar duas vezes invalida o token antigo ao confirmar", async () => {
    const sol1 = await solicitarReset(EMAIL);
    const sol2 = await solicitarReset(EMAIL);
    expect(sol1.token).not.toBe(sol2.token);

    // Confirma com o segundo token → também invalida o primeiro.
    const conf = await confirmarReset(sol2.token!, "novaSenhaForte9");
    expect(conf.ok).toBe(true);

    const reusoAntigo = await confirmarReset(sol1.token!, "maisUmaSenha9");
    expect(reusoAntigo.ok).toBe(false);
  });
});
