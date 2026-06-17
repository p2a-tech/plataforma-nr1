import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes de integração do acompanhamento de planos de ação (Onda 9 · Dev A).
 *
 * Cobre:
 *   1) resumoPlanos conta por status, vencidos, a-vencer-7d, total e %.
 *   2) verificarVencimentos cria aviso 1x por plano (idempotente, respeitando
 *      notificado_vencimento_em) e isola por empresa (RLS).
 *   3) atualizarStatusPlano seta concluido_em ao concluir e limpa ao sair.
 *
 * Exige Postgres com migrations 0001–0026 aplicadas + DATABASE_URL_APP (role
 * previa_app, p/ exercitar withEmpresa/RLS). Sem DB → skip (CI sem DB).
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;
const URL_APP = process.env.DATABASE_URL_APP;
const TEM_DB = Boolean(URL_ADMIN && URL_APP);

const EMP_A = "emp_test_acomp_a";
const EMP_B = "emp_test_acomp_b";
const FATOR = "sobrecarga"; // existe no seed 0011
const TAG = `acomp-test-${Date.now()}`;

describe.skipIf(!TEM_DB)("plano-acao · acompanhamento + vencimentos", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let lib: typeof import("@/lib/plano-acao");

  /** Insere um plano direto (bypassa a lib p/ controlar prazo/status/guard). */
  async function inserirPlano(opts: {
    empresaId: string;
    status: "pendente" | "em_andamento" | "concluido" | "cancelado";
    /** YYYY-MM-DD ou null. */
    prazo: string | null;
    titulo: string;
    notificado?: boolean;
  }): Promise<string> {
    const [row] = await admin`
      insert into public.plano_acao
        (empresa_id, fator_id, classificacao, programa, titulo_custom,
         responsavel, prazo, status, criado_por, notificado_vencimento_em)
      values
        (${opts.empresaId}, ${FATOR}, 'moderado', 'prevencionista',
         ${TAG + " · " + opts.titulo}, 'Coordenação', ${opts.prazo},
         ${opts.status}, 'tester', ${opts.notificado ? admin`now()` : null})
      returning id
    `;
    return row.id as string;
  }

  /** Conta avisos de vencimento ('generico') gerados nos testes p/ a empresa. */
  async function contarAvisos(empresaId: string): Promise<number> {
    const [r] = await admin`
      select count(*)::int as n
        from public.notificacoes
       where tipo = 'generico'
         and empresa_id = ${empresaId}
         and titulo = 'Plano de ação vencido'
         and corpo like ${"%" + TAG + "%"}
    `;
    return Number(r.n);
  }

  /** Data ISO YYYY-MM-DD deslocada `dias` a partir de hoje. */
  function diaISO(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  async function limpar() {
    await admin`delete from public.notificacoes where corpo like ${"%" + TAG + "%"}`;
    await admin`delete from public.plano_acao
                 where titulo_custom like ${TAG + "%"}
                    or empresa_id in (${EMP_A}, ${EMP_B})`;
    await admin`delete from public.empresas where id in (${EMP_A}, ${EMP_B})`;
  }

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });
    lib = await import("@/lib/plano-acao");
    await limpar();
    await admin`insert into public.empresas (id, nome) values (${EMP_A}, 'Acomp A')
                on conflict (id) do nothing`;
    await admin`insert into public.empresas (id, nome) values (${EMP_B}, 'Acomp B')
                on conflict (id) do nothing`;
  });

  afterAll(async () => {
    if (admin) {
      await limpar();
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.notificacoes where corpo like ${"%" + TAG + "%"}`;
    await admin`delete from public.plano_acao where titulo_custom like ${TAG + "%"}`;
  });

  /* ---------------------------------------------------------------------- */
  it("resumoPlanos conta por status, vencidos, a-vencer-7d e %", async () => {
    // 2 pendentes (1 vencido, 1 a vencer em 3d), 1 em_andamento (vencido),
    // 2 concluídos, 1 cancelado (com prazo vencido → NÃO conta como vencido).
    await inserirPlano({ empresaId: EMP_A, status: "pendente", prazo: diaISO(-2), titulo: "p1" });
    await inserirPlano({ empresaId: EMP_A, status: "pendente", prazo: diaISO(3), titulo: "p2" });
    await inserirPlano({ empresaId: EMP_A, status: "em_andamento", prazo: diaISO(-1), titulo: "p3" });
    await inserirPlano({ empresaId: EMP_A, status: "concluido", prazo: diaISO(-5), titulo: "p4" });
    await inserirPlano({ empresaId: EMP_A, status: "concluido", prazo: null, titulo: "p5" });
    await inserirPlano({ empresaId: EMP_A, status: "cancelado", prazo: diaISO(-9), titulo: "p6" });

    const r = await lib.resumoPlanos(EMP_A);

    expect(r.total).toBe(6);
    expect(r.por_status.pendente).toBe(2);
    expect(r.por_status.em_andamento).toBe(1);
    expect(r.por_status.concluido).toBe(2);
    expect(r.por_status.cancelado).toBe(1);
    // Vencidos: p1 (pendente, -2) + p3 (em_andamento, -1) = 2.
    // p4/p6 estão concluído/cancelado → não contam.
    expect(r.vencidos).toBe(2);
    // A vencer em 7d: p2 (pendente, +3) = 1.
    expect(r.a_vencer_7d).toBe(1);
    // % concluído: 2 de 6 = 33.
    expect(r.perc_concluido).toBe(33);
  });

  it("resumoPlanos: empresa sem planos → zeros e 0%", async () => {
    const r = await lib.resumoPlanos(EMP_B);
    expect(r.total).toBe(0);
    expect(r.perc_concluido).toBe(0);
    expect(r.vencidos).toBe(0);
    expect(r.a_vencer_7d).toBe(0);
    expect(r.por_status).toEqual({
      pendente: 0,
      em_andamento: 0,
      concluido: 0,
      cancelado: 0,
    });
  });

  it("verificarVencimentos cria aviso 1x por plano (idempotente)", async () => {
    // 1 vencido aberto, 1 vencido já notificado, 1 vencido mas concluído.
    await inserirPlano({ empresaId: EMP_A, status: "pendente", prazo: diaISO(-3), titulo: "venc-novo" });
    await inserirPlano({ empresaId: EMP_A, status: "em_andamento", prazo: diaISO(-4), titulo: "venc-ja", notificado: true });
    await inserirPlano({ empresaId: EMP_A, status: "concluido", prazo: diaISO(-10), titulo: "venc-concl" });

    const r1 = await lib.verificarVencimentos(EMP_A);
    expect(r1.notificados).toBe(1); // só o "venc-novo"
    expect(await contarAvisos(EMP_A)).toBe(1);

    // Segunda execução: nada novo (guard notificado_vencimento_em).
    const r2 = await lib.verificarVencimentos(EMP_A);
    expect(r2.notificados).toBe(0);
    expect(await contarAvisos(EMP_A)).toBe(1);
  });

  it("verificarVencimentos isola por empresa (RLS)", async () => {
    await inserirPlano({ empresaId: EMP_A, status: "pendente", prazo: diaISO(-2), titulo: "iso-a" });
    await inserirPlano({ empresaId: EMP_B, status: "pendente", prazo: diaISO(-2), titulo: "iso-b" });

    const rA = await lib.verificarVencimentos(EMP_A);
    expect(rA.notificados).toBe(1);
    expect(await contarAvisos(EMP_A)).toBe(1);
    // O plano de B não foi tocado por A.
    expect(await contarAvisos(EMP_B)).toBe(0);

    const rB = await lib.verificarVencimentos(EMP_B);
    expect(rB.notificados).toBe(1);
    expect(await contarAvisos(EMP_B)).toBe(1);
  });

  it("atualizarStatusPlano seta concluido_em ao concluir e limpa ao sair", async () => {
    const id = await inserirPlano({
      empresaId: EMP_A,
      status: "pendente",
      prazo: diaISO(5),
      titulo: "ciclo-status",
    });

    // pendente → sem concluido_em.
    const [antes] = await admin`select concluido_em from public.plano_acao where id = ${id}`;
    expect(antes.concluido_em).toBeNull();

    // → concluido: carimba.
    const concl = await lib.atualizarStatusPlano(EMP_A, id, "concluido");
    expect(concl?.status).toBe("concluido");
    expect(concl?.concluido_em).not.toBeNull();
    const carimbo = concl?.concluido_em;

    // re-salvar como concluido preserva o carimbo original.
    const concl2 = await lib.atualizarStatusPlano(EMP_A, id, "concluido");
    expect(concl2?.concluido_em).toBe(carimbo);

    // → em_andamento (sai de concluido): limpa.
    const reaberto = await lib.atualizarStatusPlano(EMP_A, id, "em_andamento");
    expect(reaberto?.status).toBe("em_andamento");
    expect(reaberto?.concluido_em).toBeNull();
  });

  it("atualizarStatusPlano retorna null p/ id inexistente", async () => {
    const r = await lib.atualizarStatusPlano(
      EMP_A,
      "00000000-0000-0000-0000-000000000000",
      "concluido",
    );
    expect(r).toBeNull();
  });
});
