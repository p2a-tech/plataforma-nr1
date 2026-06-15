import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import bcrypt from "bcryptjs";

/**
 * Testes de integração da Gestão de empresas & usuários (Onda 6 · Dev A).
 *
 * Cobre:
 *   1) criarEmpresa gera id slug + listarEmpresas conta usuários.
 *   2) criarEmpresa trata id duplicado.
 *   3) criarUsuario gera hash bcrypt válido (compareSync=true) e isola por empresa.
 *   4) criarUsuario: papel clinica exige clínica válida da mesma empresa.
 *   5) criarUsuario: e-mail duplicado é recusado.
 *   6) setUsuarioAtivo alterna o flag.
 *   7) resetarSenhaUsuario troca o hash (nova senha valida, antiga não).
 *
 * Exige Postgres com migrations 0001–0019 aplicadas. Sem DB → skip.
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const PREFIX = "emp_test_gestao_";

describe.skipIf(!URL_ADMIN)("admin-gestao · empresas & usuários", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let lib: typeof import("@/lib/admin-gestao");

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });
    lib = await import("@/lib/admin-gestao");
  });

  async function limpar() {
    // Remove usuários e clínicas das empresas de teste, depois as empresas.
    await admin`delete from public.usuarios where empresa_id like ${PREFIX + "%"}`;
    await admin`delete from public.clinicas where empresa_id like ${PREFIX + "%"}`;
    await admin`delete from public.empresas where id like ${PREFIX + "%"}`;
  }

  beforeEach(limpar);
  afterAll(async () => {
    if (admin) {
      await limpar();
      await admin.end({ timeout: 1 });
    }
  });

  /* ---------------------------------------------------------------------- */
  it("criarEmpresa gera id slug e listarEmpresas conta usuários", async () => {
    // Usa id explícito (com prefixo) para o cleanup pegar.
    const id = `${PREFIX}translog`;
    const res = await lib.criarEmpresa({
      id,
      nome: "Translog Teste S.A.",
      cnpj: "11.222.333/0001-44",
      segmento: "Logística",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.id).toBe(id);
    expect(res.data.usuarios_total).toBe(0);
    expect(res.data.usuarios_ativos).toBe(0);

    // Cria 2 usuários (1 inativo) e revalida a contagem.
    await lib.criarUsuario({
      email: "a@translog.test",
      nome: "Pessoa A",
      papel: "sst",
      empresa_id: id,
      senhaTemporaria: "senha-temporaria-1",
    });
    const u2 = await lib.criarUsuario({
      email: "b@translog.test",
      nome: "Pessoa B",
      papel: "sst",
      empresa_id: id,
      senhaTemporaria: "senha-temporaria-2",
    });
    expect(u2.ok).toBe(true);
    await lib.setUsuarioAtivo("b@translog.test", false);

    const empresas = await lib.listarEmpresas({ q: "Translog Teste" });
    const e = empresas.find((x) => x.id === id);
    expect(e).toBeDefined();
    expect(e?.usuarios_total).toBe(2);
    expect(e?.usuarios_ativos).toBe(1);
  });

  it("gerarIdEmpresa produz slug válido a partir do nome", () => {
    const slug = lib.gerarIdEmpresa("Açaí & Cia Ltda.");
    expect(slug).toMatch(/^emp_[a-z0-9_]+$/);
    // Sem acentos nem caracteres especiais.
    expect(slug).not.toMatch(/[áàâãç&. ]/);
  });

  it("criarEmpresa trata id duplicado", async () => {
    const id = `${PREFIX}dup`;
    const r1 = await lib.criarEmpresa({ id, nome: "Dup A" });
    expect(r1.ok).toBe(true);
    const r2 = await lib.criarEmpresa({ id, nome: "Dup B" });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.erro).toBe("id_duplicado");
  });

  it("criarUsuario gera hash bcrypt válido e isola por empresa", async () => {
    const idA = `${PREFIX}iso_a`;
    const idB = `${PREFIX}iso_b`;
    await lib.criarEmpresa({ id: idA, nome: "Iso A" });
    await lib.criarEmpresa({ id: idB, nome: "Iso B" });

    const senha = "MinhaSenhaForte!9";
    const res = await lib.criarUsuario(
      {
        email: "user@iso-a.test",
        nome: "User Iso A",
        papel: "sst",
        empresa_id: idA,
        senhaTemporaria: senha,
      },
      "admin@p2a.test",
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.empresa_id).toBe(idA);
    expect(res.data.criado_por).toBe("admin@p2a.test");

    // Hash persistido valida com bcryptjs (formato $2a$ compatível com login).
    const [row] = await admin`
      select senha_hash from public.usuarios where lower(email) = 'user@iso-a.test'
    `;
    expect(row.senha_hash.startsWith("$2")).toBe(true);
    expect(bcrypt.compareSync(senha, row.senha_hash)).toBe(true);
    expect(bcrypt.compareSync("senha-errada", row.senha_hash)).toBe(false);

    // Isolamento: filtrar por empresa B não traz o usuário da A.
    const listaB = await lib.listarUsuarios({ empresa_id: idB });
    expect(listaB.some((u) => u.email === "user@iso-a.test")).toBe(false);
    const listaA = await lib.listarUsuarios({ empresa_id: idA });
    expect(listaA.some((u) => u.email === "user@iso-a.test")).toBe(true);
  });

  it("criarUsuario com papel clinica exige clínica válida da mesma empresa", async () => {
    const idA = `${PREFIX}cli_a`;
    const idB = `${PREFIX}cli_b`;
    await lib.criarEmpresa({ id: idA, nome: "Cli A" });
    await lib.criarEmpresa({ id: idB, nome: "Cli B" });

    // Cria uma clínica para a empresa A (precisa webhook_secret_hash NOT NULL).
    const cliA = `${PREFIX}clinica_a`;
    await admin`
      insert into public.clinicas (id, nome, webhook_secret_hash, empresa_id, ativa)
      values (${cliA}, 'Clínica A', 'x', ${idA}, true)
    `;

    // Sem clínica → recusa.
    const semCli = await lib.criarUsuario({
      email: "clin@cli-a.test",
      nome: "Clin sem clínica",
      papel: "clinica",
      empresa_id: idA,
      senhaTemporaria: "senha-clinica-1",
    });
    expect(semCli.ok).toBe(false);
    if (!semCli.ok) expect(semCli.erro).toBe("clinica_obrigatoria");

    // Clínica de outra empresa → recusa.
    const cliErrada = await lib.criarUsuario({
      email: "clin@cli-a.test",
      nome: "Clin clínica errada",
      papel: "clinica",
      empresa_id: idB,
      clinica_id: cliA, // pertence à A, não à B
      senhaTemporaria: "senha-clinica-2",
    });
    expect(cliErrada.ok).toBe(false);
    if (!cliErrada.ok) expect(cliErrada.erro).toBe("clinica_invalida");

    // Clínica correta → cria.
    const ok = await lib.criarUsuario({
      email: "clin@cli-a.test",
      nome: "Clin correta",
      papel: "clinica",
      empresa_id: idA,
      clinica_id: cliA,
      senhaTemporaria: "senha-clinica-3",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data.clinica_id).toBe(cliA);
  });

  it("criarUsuario recusa e-mail duplicado", async () => {
    const id = `${PREFIX}emaildup`;
    await lib.criarEmpresa({ id, nome: "Email Dup" });
    const r1 = await lib.criarUsuario({
      email: "dup@x.test",
      nome: "Primeiro",
      papel: "sst",
      empresa_id: id,
      senhaTemporaria: "senha-dup-1",
    });
    expect(r1.ok).toBe(true);
    const r2 = await lib.criarUsuario({
      email: "DUP@x.test", // mesmo e-mail, case diferente
      nome: "Segundo",
      papel: "sst",
      empresa_id: id,
      senhaTemporaria: "senha-dup-2",
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.erro).toBe("email_duplicado");
  });

  it("criarUsuario recusa empresa inexistente", async () => {
    const r = await lib.criarUsuario({
      email: "ninguem@x.test",
      nome: "Ninguém",
      papel: "sst",
      empresa_id: `${PREFIX}inexistente`,
      senhaTemporaria: "senha-inexistente",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe("empresa_inexistente");
  });

  it("setUsuarioAtivo alterna o flag", async () => {
    const id = `${PREFIX}ativo`;
    await lib.criarEmpresa({ id, nome: "Ativo Empresa" });
    await lib.criarUsuario({
      email: "toggle@x.test",
      nome: "Toggle",
      papel: "sst",
      empresa_id: id,
      senhaTemporaria: "senha-toggle-1",
    });

    const off = await lib.setUsuarioAtivo("toggle@x.test", false);
    expect(off.ok).toBe(true);
    if (off.ok) expect(off.data.ativo).toBe(false);

    const on = await lib.setUsuarioAtivo("toggle@x.test", true);
    expect(on.ok).toBe(true);
    if (on.ok) expect(on.data.ativo).toBe(true);

    // Usuário inexistente → nao_encontrado.
    const nope = await lib.setUsuarioAtivo("naoexiste@x.test", false);
    expect(nope.ok).toBe(false);
    if (!nope.ok) expect(nope.erro).toBe("nao_encontrado");
  });

  it("resetarSenhaUsuario troca o hash (nova valida, antiga não)", async () => {
    const id = `${PREFIX}senha`;
    await lib.criarEmpresa({ id, nome: "Senha Empresa" });
    const senhaAntiga = "SenhaAntiga-1";
    await lib.criarUsuario({
      email: "reset@x.test",
      nome: "Reset",
      papel: "sst",
      empresa_id: id,
      senhaTemporaria: senhaAntiga,
    });

    const senhaNova = "SenhaNova-2";
    const res = await lib.resetarSenhaUsuario("reset@x.test", senhaNova);
    expect(res.ok).toBe(true);

    const [row] = await admin`
      select senha_hash from public.usuarios where lower(email) = 'reset@x.test'
    `;
    expect(bcrypt.compareSync(senhaNova, row.senha_hash)).toBe(true);
    expect(bcrypt.compareSync(senhaAntiga, row.senha_hash)).toBe(false);
  });
});
