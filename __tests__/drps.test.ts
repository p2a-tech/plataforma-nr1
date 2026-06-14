import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes de integração do DRPS (Onda 4 · Dev A).
 *
 * Exige Postgres local com as migrations 0011–0013 aplicadas. Caso a
 * DATABASE_URL_ADMIN não esteja setada, os testes ficam como skip (CI sem DB).
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMP_A = "emp_test_drps_a";
const EMP_B = "emp_test_drps_b";

describe.skipIf(!URL_ADMIN)("drps · isolamento por empresa + instrumentos", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let listarInstrumentosAtivos: typeof import("@/lib/drps")["listarInstrumentosAtivos"];
  let registrarResposta: typeof import("@/lib/drps")["registrarResposta"];
  let listarRespostas: typeof import("@/lib/drps")["listarRespostas"];
  let carregarTemplateOkebambo: typeof import("@/lib/drps")["carregarTemplateOkebambo"];

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });

    // Duas empresas de teste (idempotente).
    await admin`
      insert into public.empresas (id, nome) values
        (${EMP_A}, 'Empresa Drps A'),
        (${EMP_B}, 'Empresa Drps B')
      on conflict (id) do nothing
    `;

    // Instrumento PRÓPRIO da empresa B (para testar diferenciação global/próprio).
    await admin`
      insert into public.drps_instrumento (empresa_id, codigo, titulo, descricao, ativo)
      values (${EMP_B}, 'b_proprio_v1', 'Instrumento B próprio', null, true)
      on conflict (empresa_id, codigo) do nothing
    `;

    const mod = await import("@/lib/drps");
    listarInstrumentosAtivos = mod.listarInstrumentosAtivos;
    registrarResposta = mod.registrarResposta;
    listarRespostas = mod.listarRespostas;
    carregarTemplateOkebambo = mod.carregarTemplateOkebambo;
  });

  afterAll(async () => {
    if (admin) {
      await admin`delete from public.drps_resposta where empresa_id in (${EMP_A}, ${EMP_B})`;
      await admin`delete from public.drps_instrumento where empresa_id in (${EMP_A}, ${EMP_B})`;
      await admin`delete from public.empresas where id in (${EMP_A}, ${EMP_B})`;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.drps_resposta where empresa_id in (${EMP_A}, ${EMP_B})`;
  });

  it("listarInstrumentosAtivos retorna globais + próprios da empresa", async () => {
    const instA = await listarInstrumentosAtivos(EMP_A);
    const instB = await listarInstrumentosAtivos(EMP_B);

    // Ambas veem o template global Okêbambo.
    const okebamboA = instA.find((i) => i.codigo === "okebambo_v1");
    const okebamboB = instB.find((i) => i.codigo === "okebambo_v1");
    expect(okebamboA).toBeDefined();
    expect(okebamboA?.empresa_id).toBeNull();
    expect(okebamboB).toBeDefined();

    // Empresa A NÃO vê o instrumento próprio de B.
    expect(instA.some((i) => i.codigo === "b_proprio_v1")).toBe(false);
    // Empresa B VÊ seu próprio.
    expect(instB.some((i) => i.codigo === "b_proprio_v1" && i.empresa_id === EMP_B)).toBe(true);
  });

  it("registrarResposta + listarRespostas: isolamento por empresa", async () => {
    const tpl = await carregarTemplateOkebambo();
    expect(tpl).not.toBeNull();
    const inst = tpl!.instrumento;

    // Empresa A → 2 respostas
    await registrarResposta(EMP_A, inst.id, {
      marcador_anonimo: "marker_a_1____________________xx",
      setor: "Operacional",
      funcao: "Psicologia",
      tempo_empresa: "1 a 3 anos",
      forma_atuacao: "CLT",
      canal: "web",
      respostas: [
        { pergunta_codigo: "Q5", valor_int: 3 },
        { pergunta_codigo: "Q11", valor_int: 2 },
        { pergunta_codigo: "Q17", valor_int: 2 },
        { pergunta_codigo: "Q18", valor_int: 3 },
        { pergunta_codigo: "Q21", valor_texto: "tudo bem" },
      ],
    });
    await registrarResposta(EMP_A, inst.id, {
      marcador_anonimo: "marker_a_2____________________xx",
      setor: "Administrativa",
      funcao: "Atendente",
      tempo_empresa: "Menos de 6 meses",
      forma_atuacao: "PJ",
      canal: "whatsapp",
      respostas: [{ pergunta_codigo: "Q5", valor_int: 5 }],
    });

    // Empresa B → 1 resposta
    await registrarResposta(EMP_B, inst.id, {
      marcador_anonimo: "marker_b_1____________________xx",
      setor: "Diretoria",
      funcao: "Gestora",
      tempo_empresa: "Mais de 3 anos",
      forma_atuacao: "CLT",
      canal: "web",
      respostas: [{ pergunta_codigo: "Q5", valor_int: 4 }],
    });

    const respA = await listarRespostas(EMP_A);
    const respB = await listarRespostas(EMP_B);

    expect(respA).toHaveLength(2);
    expect(respB).toHaveLength(1);

    // Sem cross-tenant.
    expect(respA.every((r) => r.empresa_id === EMP_A)).toBe(true);
    expect(respB.every((r) => r.empresa_id === EMP_B)).toBe(true);

    // Idempotência: re-enviar o MESMO marcador não cria nova linha.
    await registrarResposta(EMP_A, inst.id, {
      marcador_anonimo: "marker_a_1____________________xx",
      setor: "Operacional",
      funcao: "Psicologia",
      tempo_empresa: "1 a 3 anos",
      forma_atuacao: "CLT",
      canal: "web",
      respostas: [{ pergunta_codigo: "Q5", valor_int: 4 }],
    });
    const respA2 = await listarRespostas(EMP_A);
    expect(respA2).toHaveLength(2); // ainda 2
  });

  it("token determinístico bate consigo mesmo e diferencia empresas", async () => {
    const { tokenDeCampanha, resolverEmpresaPorToken } = await import("@/lib/drps");
    const tA = tokenDeCampanha(EMP_A);
    const tB = tokenDeCampanha(EMP_B);
    expect(tA).not.toBe(tB);

    const empA = await resolverEmpresaPorToken(tA);
    const empB = await resolverEmpresaPorToken(tB);
    expect(empA).toBe(EMP_A);
    expect(empB).toBe(EMP_B);

    // Atalho demo
    const demo = await resolverEmpresaPorToken(`demo-token-${EMP_A}`);
    expect(demo).toBe(EMP_A);

    // Token desconhecido
    const lixo = await resolverEmpresaPorToken("xxxxxxxxxxxxxxxxxxxxxxxx");
    expect(lixo).toBeNull();
  });
});
