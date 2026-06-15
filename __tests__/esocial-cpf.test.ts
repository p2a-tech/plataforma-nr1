import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes do eSocial S-2240 por CPF (Onda 7 · Dev A).
 *
 * Cobre:
 *   1) Validação de CPF (válido / inválido / sequência repetida) — função pura.
 *   2) Máscara de CPF (revela só os 2 últimos dígitos).
 *   3) importarColaboradores: upsert por (empresa, cpf) + ISOLAMENTO por empresa.
 *   4) listarColaboradores mascara CPF por padrão; cpfCru=true devolve cru.
 *   5) gerarS2240PorTrabalhador: 1 <evtExpRisco> por colaborador ativo, com
 *      agNoc do SETOR; sem colaboradores → semColaboradores=true (encadeia agregado).
 *
 * As funções puras (CPF) rodam sempre. Os testes de DB exigem Postgres com
 * migration 0022 aplicada (DATABASE_URL_ADMIN/APP setadas).
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

/* -------------------------------------------------------------------------- */
/*  1) Funções puras de CPF (sempre rodam)                                    */
/* -------------------------------------------------------------------------- */

describe("colaboradores · validação de CPF (puro)", () => {
  it("cpfValido aceita CPFs válidos (com e sem máscara)", async () => {
    const { cpfValido } = await import("@/lib/colaboradores");
    expect(cpfValido("529.982.247-25")).toBe(true); // CPF válido conhecido
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("111.444.777-35")).toBe(true);
  });

  it("cpfValido rejeita CPFs inválidos e sequências repetidas", async () => {
    const { cpfValido } = await import("@/lib/colaboradores");
    expect(cpfValido("529.982.247-24")).toBe(false); // dígito errado
    expect(cpfValido("12345678900")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false); // todos iguais
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("123")).toBe(false); // curto
    expect(cpfValido("")).toBe(false);
  });

  it("mascararCpf revela só os 2 últimos dígitos", async () => {
    const { mascararCpf } = await import("@/lib/colaboradores");
    expect(mascararCpf("52998224725")).toBe("***.***.***-25");
    expect(mascararCpf("529.982.247-25")).toBe("***.***.***-25");
    expect(mascararCpf("123")).toBe("***.***.***-**");
  });

  it("normalizarCpf remove tudo que não é dígito", async () => {
    const { normalizarCpf } = await import("@/lib/colaboradores");
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725");
  });
});

/* -------------------------------------------------------------------------- */
/*  2) Testes de integração (DB)                                              */
/* -------------------------------------------------------------------------- */

const EMP_A = "emp_test_colab_a";
const EMP_B = "emp_test_colab_b";

// CPFs válidos para os testes.
const CPF_1 = "52998224725";
const CPF_2 = "11144477735";
const CPF_3 = "39053344705";

describe.skipIf(!URL_ADMIN)("esocial-cpf · S-2240 por trabalhador (DB)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;

  let importarColaboradores: typeof import("@/lib/colaboradores")["importarColaboradores"];
  let listarColaboradores: typeof import("@/lib/colaboradores")["listarColaboradores"];
  let setAtivo: typeof import("@/lib/colaboradores")["setAtivo"];
  let contarPorSetor: typeof import("@/lib/colaboradores")["contarPorSetor"];
  let gerarS2240PorTrabalhador: typeof import("@/lib/esocial-s2240")["gerarS2240PorTrabalhador"];
  let withEmpresa: typeof import("@/lib/tenant")["withEmpresa"];

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });
    await admin`
      insert into public.empresas (id, nome) values
        (${EMP_A}, 'Empresa Colab A'),
        (${EMP_B}, 'Empresa Colab B')
      on conflict (id) do nothing
    `;

    ({ importarColaboradores, listarColaboradores, setAtivo, contarPorSetor } =
      await import("@/lib/colaboradores"));
    ({ gerarS2240PorTrabalhador } = await import("@/lib/esocial-s2240"));
    ({ withEmpresa } = await import("@/lib/tenant"));
  });

  afterAll(async () => {
    if (admin) {
      await admin`delete from public.colaborador_registro where empresa_id in (${EMP_A}, ${EMP_B})`;
      await admin`delete from public.empresas where id in (${EMP_A}, ${EMP_B})`;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.colaborador_registro where empresa_id in (${EMP_A}, ${EMP_B})`;
  });

  it("importarColaboradores faz upsert e separa erros das linhas válidas", async () => {
    const r1 = await importarColaboradores(EMP_A, [
      { cpf: CPF_1, nome: "Ana", setor: "Comercial", cargo: "Vendas" },
      { cpf: CPF_2, nome: "Bruno", setor: "Produção" },
      { cpf: "12345678900", nome: "Inválido", setor: "Produção" }, // CPF inválido
      { cpf: CPF_3, nome: "Carla" }, // falta setor
    ]);

    expect(r1.inseridos).toBe(2);
    expect(r1.atualizados).toBe(0);
    expect(r1.erros.length).toBe(2);

    // Re-import do mesmo CPF com dado novo → ATUALIZA (não duplica).
    const r2 = await importarColaboradores(EMP_A, [
      { cpf: "529.982.247-25", nome: "Ana Maria", setor: "Comercial", cargo: "Gerente" },
    ]);
    expect(r2.inseridos).toBe(0);
    expect(r2.atualizados).toBe(1);

    const lista = await listarColaboradores(EMP_A, { cpfCru: true });
    expect(lista.length).toBe(2);
    const ana = lista.find((c) => c.cpf === CPF_1);
    expect(ana?.nome).toBe("Ana Maria");
    expect(ana?.cargo).toBe("Gerente");
  });

  it("isola colaboradores por empresa (RLS)", async () => {
    await importarColaboradores(EMP_A, [{ cpf: CPF_1, nome: "Ana", setor: "Comercial" }]);
    await importarColaboradores(EMP_B, [{ cpf: CPF_2, nome: "Bruno", setor: "Produção" }]);

    const listaA = await listarColaboradores(EMP_A, { cpfCru: true });
    const listaB = await listarColaboradores(EMP_B, { cpfCru: true });

    expect(listaA.map((c) => c.cpf)).toEqual([CPF_1]);
    expect(listaB.map((c) => c.cpf)).toEqual([CPF_2]);
    // Mesmo CPF pode coexistir em empresas diferentes (UNIQUE é por empresa).
    const r = await importarColaboradores(EMP_B, [{ cpf: CPF_1, nome: "Ana B", setor: "X" }]);
    expect(r.inseridos).toBe(1);
  });

  it("listarColaboradores mascara CPF por padrão; cpfCru devolve cru", async () => {
    await importarColaboradores(EMP_A, [{ cpf: CPF_1, nome: "Ana", setor: "Comercial" }]);

    const mascarado = await listarColaboradores(EMP_A);
    expect(mascarado[0].cpf).toBe("***.***.***-25");

    const cru = await listarColaboradores(EMP_A, { cpfCru: true });
    expect(cru[0].cpf).toBe(CPF_1);
  });

  it("contarPorSetor conta só ativos", async () => {
    await importarColaboradores(EMP_A, [
      { cpf: CPF_1, nome: "Ana", setor: "Comercial" },
      { cpf: CPF_2, nome: "Bruno", setor: "Comercial" },
      { cpf: CPF_3, nome: "Carla", setor: "Produção", ativo: false },
    ]);
    const contagem = await contarPorSetor(EMP_A);
    const comercial = contagem.find((c) => c.setor === "Comercial");
    expect(comercial?.total).toBe(2);
    // Produção tem 1 colaborador inativo → não aparece.
    expect(contagem.find((c) => c.setor === "Produção")).toBeUndefined();
  });

  it("gerarS2240PorTrabalhador emite 1 evtExpRisco por colaborador ativo", async () => {
    // Setores que existem no inventário mock (fallback quando sem eventos reais):
    // "Comercial" e "Produção" têm riscos no mock.
    await importarColaboradores(EMP_A, [
      { cpf: CPF_1, nome: "Ana", setor: "Comercial", matricula: "M-100" },
      { cpf: CPF_2, nome: "Bruno", setor: "Produção" },
      { cpf: CPF_3, nome: "Carla", setor: "Comercial", ativo: false }, // inativa → fora
    ]);

    const res = await withEmpresa(EMP_A, () =>
      gerarS2240PorTrabalhador(EMP_A, "2026-06"),
    );

    expect(res.semColaboradores).toBe(false);
    expect(res.quantEventos).toBe(2); // só os 2 ativos

    // Conta os blocos <evtExpRisco> no XML.
    const eventos = res.xml.match(/<evtExpRisco /g) ?? [];
    expect(eventos.length).toBe(2);

    // CPF real (cru) aparece no <cpfTrab> — fan-out por trabalhador.
    expect(res.xml).toContain(`<cpfTrab>${CPF_1}</cpfTrab>`);
    expect(res.xml).toContain(`<cpfTrab>${CPF_2}</cpfTrab>`);
    // Carla (inativa) NÃO entra.
    expect(res.xml).not.toContain(`<cpfTrab>${CPF_3}</cpfTrab>`);

    // Matrícula real preservada quando informada.
    expect(res.xml).toContain("<matricula>M-100</matricula>");
    // Sem matrícula → fallback CPF-...
    expect(res.xml).toContain(`<matricula>CPF-${CPF_2}</matricula>`);

    // O setor de cada evento aparece em <dscSetor>, e há ao menos 1 <agNoc>
    // derivado do perfil de risco do setor (mock tem riscos em Comercial/Produção).
    expect(res.xml).toContain("<dscSetor>Comercial</dscSetor>");
    expect(res.xml).toContain("<dscSetor>Produção</dscSetor>");
    expect(res.xml).toContain("<agNoc>");
    // Metodologia comentada no header.
    expect(res.xml).toContain("MODO POR TRABALHADOR");
  });

  it("sem colaboradores ativos → semColaboradores=true (encadeia agregado)", async () => {
    // Nenhum colaborador cadastrado.
    const res = await withEmpresa(EMP_A, () =>
      gerarS2240PorTrabalhador(EMP_A, "2026-06"),
    );
    expect(res.semColaboradores).toBe(true);
    expect(res.quantEventos).toBe(0);
    expect(res.xml).toBe("");
  });
});
