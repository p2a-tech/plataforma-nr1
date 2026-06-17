import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes de integração da camada de LEITURA das notificações in-app
 * (Onda 8 · Dev A · lib/notificacoes.ts).
 *
 * Cobre:
 *   1) sst isola por empresa: vê só as da própria empresa, NUNCA de outra, e
 *      NUNCA reset_senha (mesmo sendo da sua empresa).
 *   2) admin vê todas (todas as empresas + empresa_id NULL) e todos os tipos.
 *   3) marcarLida seta lida_em (e respeita o escopo de empresa do sst).
 *   4) contarNaoLidas decrementa após marcar.
 *
 * Exige Postgres com migrations 0001–0025 aplicadas. Sem DB → skip (CI sem DB).
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMP_A = "emp_test_notif_a";
const EMP_B = "emp_test_notif_b";
const TAG = `notif-test-${Date.now()}`;

describe.skipIf(!URL_ADMIN)("notificacoes · leitura, escopo por papel e marcação", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let lib: typeof import("@/lib/notificacoes");

  async function limpar() {
    await admin`delete from public.notificacoes where titulo like ${TAG + "%"}`;
    await admin`delete from public.empresas where id in (${EMP_A}, ${EMP_B})`;
  }

  /** Insere uma notificação direto (simula o que lib/notify.ts escreve). */
  async function inserir(
    tipo: string,
    empresaId: string | null,
    sufixo: string,
  ): Promise<string> {
    const [row] = await admin`
      insert into public.notificacoes (tipo, empresa_id, titulo, corpo, canal, status)
      values (${tipo}, ${empresaId}, ${TAG + "-" + sufixo}, 'corpo', 'persistido', 'enfileirada')
      returning id
    `;
    return row.id as string;
  }

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });
    lib = await import("@/lib/notificacoes");
    await limpar();
    await admin`insert into public.empresas (id, nome) values (${EMP_A}, 'Notif A')
                on conflict (id) do nothing`;
    await admin`insert into public.empresas (id, nome) values (${EMP_B}, 'Notif B')
                on conflict (id) do nothing`;
  });

  afterAll(async () => {
    if (admin) {
      await limpar();
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.notificacoes where titulo like ${TAG + "%"}`;
  });

  /* ---------------------------------------------------------------------- */
  it("sst vê só as da própria empresa e NUNCA reset_senha", async () => {
    await inserir("risco_grave", EMP_A, "rg-a");
    await inserir("dsar", EMP_A, "dsar-a");
    await inserir("generico", EMP_A, "gen-a");
    await inserir("reset_senha", EMP_A, "reset-a"); // mesma empresa, mas tipo proibido
    await inserir("risco_grave", EMP_B, "rg-b"); // outra empresa
    await inserir("dsar", null, "dsar-null"); // sem empresa (triagem)

    const lista = await lib.listarNotificacoes({
      empresaId: EMP_A,
      papel: "sst",
      limit: 100,
    });
    const titulos = lista.map((n) => n.titulo);

    // Vê as 3 relevantes da própria empresa.
    expect(titulos).toContain(`${TAG}-rg-a`);
    expect(titulos).toContain(`${TAG}-dsar-a`);
    expect(titulos).toContain(`${TAG}-gen-a`);
    // NÃO vê reset_senha (mesmo sendo da empresa).
    expect(titulos).not.toContain(`${TAG}-reset-a`);
    // NÃO vê a de outra empresa.
    expect(titulos).not.toContain(`${TAG}-rg-b`);
    // NÃO vê as de empresa_id NULL.
    expect(titulos).not.toContain(`${TAG}-dsar-null`);
    // Todas as visíveis são da empresa A.
    expect(lista.every((n) => n.empresa_id === EMP_A)).toBe(true);
    // Nenhuma é reset_senha.
    expect(lista.every((n) => n.tipo !== "reset_senha")).toBe(true);
  });

  it("admin vê todas (todas as empresas + NULL) e todos os tipos", async () => {
    await inserir("risco_grave", EMP_A, "rg-a");
    await inserir("reset_senha", EMP_A, "reset-a");
    await inserir("risco_grave", EMP_B, "rg-b");
    await inserir("dsar", null, "dsar-null");

    const lista = await lib.listarNotificacoes({ papel: "admin", limit: 200 });
    const titulos = lista.map((n) => n.titulo);

    expect(titulos).toContain(`${TAG}-rg-a`);
    expect(titulos).toContain(`${TAG}-reset-a`); // admin VÊ reset_senha
    expect(titulos).toContain(`${TAG}-rg-b`); // de outra empresa
    expect(titulos).toContain(`${TAG}-dsar-null`); // sem empresa
  });

  it("marcarLida seta lida_em e respeita o escopo de empresa do sst", async () => {
    const idA = await inserir("risco_grave", EMP_A, "rg-a");
    const idB = await inserir("risco_grave", EMP_B, "rg-b");

    // sst de A NÃO consegue marcar a de B (fora do escopo).
    const foraEscopo = await lib.marcarLida(idB, EMP_A);
    expect(foraEscopo).toBe(false);
    const [linhaB] = await admin`select lida_em from public.notificacoes where id = ${idB}`;
    expect(linhaB.lida_em).toBeNull();

    // sst de A marca a própria.
    const ok = await lib.marcarLida(idA, EMP_A);
    expect(ok).toBe(true);
    const [linhaA] = await admin`select lida_em from public.notificacoes where id = ${idA}`;
    expect(linhaA.lida_em).not.toBeNull();

    // admin (sem escopo) marca a de B.
    const okAdmin = await lib.marcarLida(idB, undefined);
    expect(okAdmin).toBe(true);
    const [linhaB2] = await admin`select lida_em from public.notificacoes where id = ${idB}`;
    expect(linhaB2.lida_em).not.toBeNull();
  });

  it("contarNaoLidas decrementa após marcar (e marcarTodasLidas zera)", async () => {
    const id1 = await inserir("risco_grave", EMP_A, "rg-a");
    await inserir("dsar", EMP_A, "dsar-a");
    await inserir("reset_senha", EMP_A, "reset-a"); // não conta para sst

    // sst conta só as 2 visíveis (risco_grave + dsar), não o reset_senha.
    const antes = await lib.contarNaoLidas(EMP_A, "sst");
    expect(antes).toBe(2);

    await lib.marcarLida(id1, EMP_A);
    const depois = await lib.contarNaoLidas(EMP_A, "sst");
    expect(depois).toBe(1);

    const marcadas = await lib.marcarTodasLidas(EMP_A, "sst");
    expect(marcadas).toBe(1); // só a dsar restante
    const zero = await lib.contarNaoLidas(EMP_A, "sst");
    expect(zero).toBe(0);

    // O reset_senha continua não lido no banco, mas invisível ao sst.
    const [reset] = await admin`
      select lida_em from public.notificacoes where titulo = ${TAG + "-reset-a"}
    `;
    expect(reset.lida_em).toBeNull();
  });
});
