import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes de integração das campanhas DRPS (Onda 5 · Dev B · §8 BACKLOG_OKEBAMBO).
 *
 * Cobre:
 *   1) gerarTokenCampanha gera valores únicos.
 *   2) criarCampanha persiste o token.
 *   3) obterCampanhaPorToken funciona cross-tenant (lookup explícito).
 *   4) desativarCampanha bloqueia novas respostas.
 *   5) registrarResposta sem campanha_id usa a 'ativa mais recente'.
 *
 * Exige Postgres com migrations 0011–0018 aplicadas.
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMP_A = "emp_test_drps_camp_a";
const EMP_B = "emp_test_drps_camp_b";

describe.skipIf(!URL_ADMIN)("drps-campanha · §8 token persistente", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let instId: string;

  let gerarTokenCampanha: typeof import("@/lib/drps-campanha")["gerarTokenCampanha"];
  let criarCampanha: typeof import("@/lib/drps-campanha")["criarCampanha"];
  let listarCampanhas: typeof import("@/lib/drps-campanha")["listarCampanhas"];
  let desativarCampanha: typeof import("@/lib/drps-campanha")["desativarCampanha"];
  let obterCampanhaPorToken: typeof import("@/lib/drps-campanha")["obterCampanhaPorToken"];
  let campanhaAceitaRespostas: typeof import("@/lib/drps-campanha")["campanhaAceitaRespostas"];
  let registrarResposta: typeof import("@/lib/drps")["registrarResposta"];
  let resolverCampanhaPorToken: typeof import("@/lib/drps")["resolverCampanhaPorToken"];

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });

    await admin`
      insert into public.empresas (id, nome) values
        (${EMP_A}, 'Empresa Camp A'),
        (${EMP_B}, 'Empresa Camp B')
      on conflict (id) do nothing
    `;

    const [tpl] = await admin`
      select id from public.drps_instrumento
       where empresa_id is null and codigo = 'okebambo_v1' and ativo = true
       limit 1
    `;
    if (!tpl) {
      throw new Error("Template okebambo_v1 ausente — migrations não aplicadas?");
    }
    instId = tpl.id;

    const modCamp = await import("@/lib/drps-campanha");
    gerarTokenCampanha = modCamp.gerarTokenCampanha;
    criarCampanha = modCamp.criarCampanha;
    listarCampanhas = modCamp.listarCampanhas;
    desativarCampanha = modCamp.desativarCampanha;
    obterCampanhaPorToken = modCamp.obterCampanhaPorToken;
    campanhaAceitaRespostas = modCamp.campanhaAceitaRespostas;

    const modDrps = await import("@/lib/drps");
    registrarResposta = modDrps.registrarResposta;
    resolverCampanhaPorToken = modDrps.resolverCampanhaPorToken;
  });

  afterAll(async () => {
    if (admin) {
      await admin`delete from public.drps_resposta where empresa_id in (${EMP_A}, ${EMP_B})`;
      await admin`delete from public.drps_campanha where empresa_id in (${EMP_A}, ${EMP_B})`;
      await admin`delete from public.empresas where id in (${EMP_A}, ${EMP_B})`;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.drps_resposta where empresa_id in (${EMP_A}, ${EMP_B})`;
    await admin`delete from public.drps_campanha where empresa_id in (${EMP_A}, ${EMP_B})`;
  });

  it("gerarTokenCampanha gera tokens únicos e de tamanho razoável", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const t = gerarTokenCampanha();
      expect(t.length).toBeGreaterThanOrEqual(20);
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
      tokens.add(t);
    }
    expect(tokens.size).toBe(50);
  });

  it("criarCampanha persiste e expõe via obterCampanhaPorToken (cross-tenant)", async () => {
    const c = await criarCampanha(EMP_A, {
      codigo: "q1-2026",
      titulo: "Q1 2026",
      ciclo: "q1-2026",
      instrumento_id: instId,
    });

    expect(c.token).toBeTruthy();
    expect(c.empresa_id).toBe(EMP_A);
    expect(c.ciclo).toBe("q1-2026");

    // Lookup cross-tenant (sem withEmpresa) deve achar.
    const resolvido = await obterCampanhaPorToken(c.token);
    expect(resolvido).not.toBeNull();
    expect(resolvido?.empresa_id).toBe(EMP_A);
    expect(resolvido?.campanha_id).toBe(c.id);

    // Token de outra empresa não deve bater.
    const c2 = await criarCampanha(EMP_B, {
      codigo: "q1-2026",
      titulo: "Q1 2026 B",
      ciclo: "q1-2026",
      instrumento_id: instId,
    });
    expect(c2.token).not.toBe(c.token);

    const r2 = await obterCampanhaPorToken(c2.token);
    expect(r2?.empresa_id).toBe(EMP_B);
  });

  it("desativarCampanha bloqueia coleta (campanhaAceitaRespostas=false)", async () => {
    const c = await criarCampanha(EMP_A, {
      codigo: "ativa",
      titulo: "Ativa",
      ciclo: "ativa",
      instrumento_id: instId,
    });

    const antes = await obterCampanhaPorToken(c.token);
    expect(antes?.ativo).toBe(true);
    expect(campanhaAceitaRespostas(antes!)).toBe(true);

    const ok = await desativarCampanha(EMP_A, c.id);
    expect(ok).toBe(true);

    // FIX (Onda 5 · segurança): obterCampanhaPorToken filtra ativo/expiração
    // direto no SQL, então campanha desativada some do lookup (retorna null).
    const depois = await obterCampanhaPorToken(c.token);
    expect(depois).toBeNull();

    // resolverCampanhaPorToken recusa inativas.
    const r = await resolverCampanhaPorToken(c.token);
    expect(r).toBeNull();
  });

  it("obterCampanhaPorToken ignora campanha expirada (expira_em no passado)", async () => {
    const c = await criarCampanha(EMP_A, {
      codigo: "expirada",
      titulo: "Expirada",
      ciclo: "expirada",
      instrumento_id: instId,
      // expira_em no passado → não deve aceitar respostas.
      expira_em: new Date(Date.now() - 60_000).toISOString(),
    });

    // Lookup recusa: filtro SQL (expira_em > now()) elimina a linha.
    const resolvido = await obterCampanhaPorToken(c.token);
    expect(resolvido).toBeNull();

    // E resolverCampanhaPorToken (que depende disto) também recusa.
    const r = await resolverCampanhaPorToken(c.token);
    expect(r).toBeNull();
  });

  it("listarCampanhas filtra por empresa (RLS via withEmpresa)", async () => {
    await criarCampanha(EMP_A, {
      codigo: "ca",
      titulo: "Ca",
      ciclo: "ca",
      instrumento_id: instId,
    });
    await criarCampanha(EMP_B, {
      codigo: "cb",
      titulo: "Cb",
      ciclo: "cb",
      instrumento_id: instId,
    });

    const listaA = await listarCampanhas(EMP_A);
    const listaB = await listarCampanhas(EMP_B);

    expect(listaA.some((c) => c.codigo === "ca")).toBe(true);
    expect(listaA.some((c) => c.codigo === "cb")).toBe(false);
    expect(listaB.some((c) => c.codigo === "cb")).toBe(true);
    expect(listaB.some((c) => c.codigo === "ca")).toBe(false);
  });

  it("registrarResposta sem campanha_id usa a ativa mais recente", async () => {
    // Primeira campanha (anterior).
    const c1 = await criarCampanha(EMP_A, {
      codigo: "antiga",
      titulo: "Antiga",
      ciclo: "antiga",
      instrumento_id: instId,
    });
    // Pequena pausa pra garantir ordem por criado_em.
    await new Promise((r) => setTimeout(r, 10));
    const c2 = await criarCampanha(EMP_A, {
      codigo: "atual",
      titulo: "Atual",
      ciclo: "atual",
      instrumento_id: instId,
    });

    const resposta = await registrarResposta(EMP_A, instId, {
      marcador_anonimo: "mkr_sem_camp__________________xx",
      setor: "Operacional",
      funcao: "Psicologia",
      canal: "web",
      respostas: [{ pergunta_codigo: "Q5", valor_int: 3 }],
    });

    expect(resposta.campanha_id).toBe(c2.id);
    expect(resposta.campanha_id).not.toBe(c1.id);
  });

  it("registrarResposta com campanha_id explícita usa o id passado", async () => {
    const c = await criarCampanha(EMP_A, {
      codigo: "explicit",
      titulo: "Explicit",
      ciclo: "explicit",
      instrumento_id: instId,
    });

    const resposta = await registrarResposta(
      EMP_A,
      instId,
      {
        marcador_anonimo: "mkr_with_camp________________xx",
        setor: "Operacional",
        funcao: "Psicologia",
        canal: "web",
        respostas: [{ pergunta_codigo: "Q5", valor_int: 4 }],
      },
      c.id,
    );

    expect(resposta.campanha_id).toBe(c.id);
  });

  it("registrarResposta sem nenhuma campanha cria 'Avulso' como fallback", async () => {
    // Nada criado — beforeEach já limpou tudo.
    const resposta = await registrarResposta(EMP_A, instId, {
      marcador_anonimo: "mkr_avulso____________________xx",
      setor: "Operacional",
      funcao: "Psicologia",
      canal: "web",
      respostas: [{ pergunta_codigo: "Q5", valor_int: 3 }],
    });

    expect(resposta.campanha_id).not.toBeNull();
    // Verifica que a campanha 'avulso' realmente existe.
    const [camp] = await admin`
      select codigo from public.drps_campanha
       where id = ${resposta.campanha_id} and empresa_id = ${EMP_A}
    `;
    expect(camp?.codigo).toBe("avulso");
  });
});
