import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes de integração do protocolo de risco grave/iminente (E8).
 *
 * Exige o Postgres local (docker compose). Se DATABASE_URL_ADMIN não estiver
 * setada (CI sem DB) os testes ficam como skip.
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMP_A = "emp_test_e8_a";
const EMP_B = "emp_test_e8_b";

describe.skipIf(!URL_ADMIN)("risco-grave · isolamento por empresa + encerrar", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listar: typeof import("@/lib/risco-grave")["listarEventosAtivos"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let criar: typeof import("@/lib/risco-grave")["criarEvento"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let encerrar: typeof import("@/lib/risco-grave")["encerrarEvento"];

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });
    // Cria duas empresas de teste (idempotente).
    await admin`
      insert into public.empresas (id, nome) values
        (${EMP_A}, 'Empresa Teste A'),
        (${EMP_B}, 'Empresa Teste B')
      on conflict (id) do nothing
    `;
    const mod = await import("@/lib/risco-grave");
    listar = mod.listarEventosAtivos;
    criar = mod.criarEvento;
    encerrar = mod.encerrarEvento;
  });

  afterAll(async () => {
    if (admin) {
      await admin`delete from public.eventos_risco_grave where empresa_id in (${EMP_A}, ${EMP_B})`;
      await admin`delete from public.empresas where id in (${EMP_A}, ${EMP_B})`;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.eventos_risco_grave where empresa_id in (${EMP_A}, ${EMP_B})`;
  });

  it("listarEventosAtivos só vê eventos da própria empresa (RLS + filtro app)", async () => {
    await criar(EMP_A, {
      marcador_anonimo: "sess_a_001",
      tipo: "ideacao_suicida",
      severidade: 5,
      escalonado_para: "DPO",
    });
    await criar(EMP_B, {
      marcador_anonimo: "sess_b_001",
      tipo: "violencia_iminente",
      severidade: 4,
    });

    const ativosA = await listar(EMP_A);
    const ativosB = await listar(EMP_B);

    expect(ativosA).toHaveLength(1);
    expect(ativosA[0]?.marcador_anonimo).toBe("sess_a_001");
    expect(ativosA[0]?.empresa_id).toBe(EMP_A);

    expect(ativosB).toHaveLength(1);
    expect(ativosB[0]?.marcador_anonimo).toBe("sess_b_001");
    expect(ativosB[0]?.empresa_id).toBe(EMP_B);

    // Nenhum cruzamento.
    expect(ativosA.find((e) => e.empresa_id === EMP_B)).toBeUndefined();
    expect(ativosB.find((e) => e.empresa_id === EMP_A)).toBeUndefined();
  });

  it("encerrarEvento marca como encerrado e remove da listagem ativa", async () => {
    const evento = await criar(EMP_A, {
      marcador_anonimo: "sess_a_002",
      tipo: "surto_psiquico",
      severidade: 3,
    });
    expect(evento.status).toBe("aberto");

    // Antes: aparece nos ativos.
    const antes = await listar(EMP_A);
    expect(antes.some((e) => e.id === evento.id)).toBe(true);

    // Encerra.
    const enc = await encerrar(EMP_A, evento.id, "atendido pelo SST");
    expect(enc).not.toBeNull();
    expect(enc?.status).toBe("encerrado");
    expect(enc?.encerrado_em).not.toBeNull();
    expect(enc?.notas).toBe("atendido pelo SST");

    // Depois: sai da lista ativa.
    const depois = await listar(EMP_A);
    expect(depois.some((e) => e.id === evento.id)).toBe(false);

    // Não pode encerrar evento de outra empresa (RLS bloqueia, retorna null).
    const eventoB = await criar(EMP_B, {
      marcador_anonimo: "sess_b_002",
      tipo: "outros",
      severidade: 2,
    });
    const tentativaCross = await encerrar(EMP_A, eventoB.id);
    expect(tentativaCross).toBeNull();
  });
});
