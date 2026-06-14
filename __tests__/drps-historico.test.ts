import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes de integração do histórico DRPS (Onda 5 · Dev B · §8 BACKLOG_OKEBAMBO).
 *
 * Cobre:
 *   1) serieDimensoes retorna ordenado por data_inicio do ciclo, com isolamento
 *      por empresa (RLS via withEmpresa).
 *   2) compararCiclos detecta regressão quando delta > 0.5.
 *   3) alertasRegressao só dispara para a empresa correta.
 *
 * Exige Postgres com migrations 0011–0018 aplicadas. Sem DATABASE_URL_ADMIN
 * → skip (igual aos outros testes do projeto).
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMP_A = "emp_test_drps_hist_a";
const EMP_B = "emp_test_drps_hist_b";

describe.skipIf(!URL_ADMIN)("drps-historico · §8 comparativo histórico", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let instId: string;
  let serieDimensoes: typeof import("@/lib/drps-historico")["serieDimensoes"];
  let compararCiclos: typeof import("@/lib/drps-historico")["compararCiclos"];
  let alertasRegressao: typeof import("@/lib/drps-historico")["alertasRegressao"];

  /**
   * Helper · cria uma campanha + N respostas com `valor_int` constante em
   * todas as perguntas pesáveis do template Okêbambo. Útil para forçar uma
   * média conhecida.
   */
  async function criarCampanhaComRespostas(opts: {
    empresaId: string;
    codigo: string;
    ciclo: string;
    valor: number;
    n: number;
    respondidoEm?: string; // ISO; default = now
  }) {
    // Token único por inserção pra evitar colisão entre testes (mesmo `codigo`
    // pode aparecer em mais de um `it()` após beforeEach que limpa por empresa).
    const token = `t_${opts.codigo}_${opts.empresaId}_${Math.random()
      .toString(36)
      .slice(2, 10)}`.slice(0, 32);
    const [camp] = await admin`
      insert into public.drps_campanha
        (empresa_id, instrumento_id, codigo, titulo, token, ciclo, ativo)
      values
        (${opts.empresaId}, ${instId}, ${opts.codigo}, ${opts.codigo}, ${token},
         ${opts.ciclo}, true)
      on conflict (empresa_id, codigo) do update
         set titulo = excluded.titulo
      returning id
    `;

    // Pega perguntas pesáveis do instrumento (likert5_inverso, likert3_freq,
    // impacto4, esgotamento5).
    const perguntas = await admin`
      select id, codigo, tipo
        from public.drps_pergunta
       where instrumento_id = ${instId}
         and tipo in ('likert5_inverso','likert3_freq','impacto4','esgotamento5')
    `;

    for (let i = 0; i < opts.n; i++) {
      const marker = `mkr_${opts.codigo}_${i}_${opts.empresaId}`
        .padEnd(32, "x")
        .slice(0, 32);
      const [resp] = await admin`
        insert into public.drps_resposta
          (empresa_id, instrumento_id, campanha_id, marcador_anonimo,
           setor, funcao, canal, respondido_em)
        values
          (${opts.empresaId}, ${instId}, ${camp.id}, ${marker},
           'Operacional', 'Psicologia', 'web',
           ${opts.respondidoEm ?? new Date().toISOString()})
        on conflict (instrumento_id, marcador_anonimo) do update
           set respondido_em = excluded.respondido_em
        returning id
      `;
      // Limpa items antigos pra idempotência.
      await admin`delete from public.drps_resposta_item where resposta_id = ${resp.id}`;
      for (const p of perguntas) {
        // Garante valor compatível com cada escala.
        let v = opts.valor;
        if (p.tipo === "likert3_freq" && v > 3) v = 3;
        if (p.tipo === "impacto4" && v > 4) v = 4;
        await admin`
          insert into public.drps_resposta_item
            (resposta_id, pergunta_id, valor_int)
          values
            (${resp.id}, ${p.id}, ${v})
        `;
      }
    }
    return camp.id as string;
  }

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });

    await admin`
      insert into public.empresas (id, nome) values
        (${EMP_A}, 'Empresa Hist A'),
        (${EMP_B}, 'Empresa Hist B')
      on conflict (id) do nothing
    `;

    // Resolve o template global Okêbambo (seedado pelas migrations).
    const [tpl] = await admin`
      select id from public.drps_instrumento
       where empresa_id is null and codigo = 'okebambo_v1' and ativo = true
       limit 1
    `;
    if (!tpl) {
      throw new Error("Template okebambo_v1 ausente — migrations não aplicadas?");
    }
    instId = tpl.id;

    const mod = await import("@/lib/drps-historico");
    serieDimensoes = mod.serieDimensoes;
    compararCiclos = mod.compararCiclos;
    alertasRegressao = mod.alertasRegressao;
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

  it("serieDimensoes retorna ordenado e isola por empresa", async () => {
    // Ciclo 1 baixo em A
    await criarCampanhaComRespostas({
      empresaId: EMP_A,
      codigo: "q1-2026-a",
      ciclo: "q1-2026",
      valor: 1,
      n: 3,
      respondidoEm: "2026-01-15T10:00:00Z",
    });
    // Ciclo 2 alto em A
    await criarCampanhaComRespostas({
      empresaId: EMP_A,
      codigo: "q2-2026-a",
      ciclo: "q2-2026",
      valor: 5,
      n: 3,
      respondidoEm: "2026-04-15T10:00:00Z",
    });
    // Empresa B → 1 ciclo
    await criarCampanhaComRespostas({
      empresaId: EMP_B,
      codigo: "q1-2026-b",
      ciclo: "q1-2026",
      valor: 3,
      n: 3,
      respondidoEm: "2026-01-15T10:00:00Z",
    });

    const sA = await serieDimensoes(EMP_A);
    const sB = await serieDimensoes(EMP_B);

    // A tem 2 ciclos (q1, q2) ordenados por data.
    expect(sA.map((p) => p.ciclo)).toEqual(["q1-2026", "q2-2026"]);
    // O template Okêbambo cobre 4 dimensões NR-1 nas perguntas pesáveis
    // (org_trabalho, condicoes, relacoes, carga_emocional). `seguranca_emoc`
    // entra via §2 só nas perguntas demográficas/abertas.
    expect(sA[0].mediaPorDim.length).toBeGreaterThanOrEqual(4);
    expect(sA[0].media_geral).toBeCloseTo(1, 1);
    expect(sA[1].media_geral).toBeCloseTo(5, 1);

    // B tem só 1 ciclo, isolado: NÃO vê os ciclos de A.
    expect(sB).toHaveLength(1);
    expect(sB[0].ciclo).toBe("q1-2026");
    // Valor 3 entra em escalas diferentes (likert5_inverso=3, likert3_freq=3→5,
    // impacto4=3→3.67, esgotamento5=3) — a média ponderada cai entre 3 e 4.
    expect(sB[0].media_geral).toBeGreaterThan(2.5);
    expect(sB[0].media_geral).toBeLessThan(4);
  });

  it("compararCiclos detecta regressão quando delta > 0.5", async () => {
    await criarCampanhaComRespostas({
      empresaId: EMP_A,
      codigo: "c1",
      ciclo: "ciclo-1",
      valor: 2, // baixo
      n: 3,
      respondidoEm: "2026-01-15T10:00:00Z",
    });
    await criarCampanhaComRespostas({
      empresaId: EMP_A,
      codigo: "c2",
      ciclo: "ciclo-2",
      valor: 5, // alto — delta deve ser ~+3 em todas as dimensões
      n: 3,
      respondidoEm: "2026-04-15T10:00:00Z",
    });

    const cmp = await compararCiclos(EMP_A, "ciclo-1", "ciclo-2");
    expect(cmp.length).toBeGreaterThanOrEqual(4); // 4 dimensões pesáveis no template
    for (const c of cmp) {
      expect(c.delta).toBeGreaterThan(0.5);
      expect(c.regressao).toBe(true);
    }
  });

  it("compararCiclos NÃO marca regressão quando delta <= 0.5", async () => {
    await criarCampanhaComRespostas({
      empresaId: EMP_A,
      codigo: "c1",
      ciclo: "ciclo-1",
      valor: 3,
      n: 3,
      respondidoEm: "2026-01-15T10:00:00Z",
    });
    await criarCampanhaComRespostas({
      empresaId: EMP_A,
      codigo: "c2",
      ciclo: "ciclo-2",
      valor: 3, // mesmo valor → delta 0
      n: 3,
      respondidoEm: "2026-04-15T10:00:00Z",
    });

    const cmp = await compararCiclos(EMP_A, "ciclo-1", "ciclo-2");
    for (const c of cmp) {
      expect(Math.abs(c.delta)).toBeLessThanOrEqual(0.5);
      expect(c.regressao).toBe(false);
    }
  });

  it("alertasRegressao isola por empresa", async () => {
    // A regride entre os 2 ciclos consecutivos mais recentes.
    await criarCampanhaComRespostas({
      empresaId: EMP_A,
      codigo: "c1",
      ciclo: "c1",
      valor: 1,
      n: 3,
      respondidoEm: "2026-01-15T10:00:00Z",
    });
    await criarCampanhaComRespostas({
      empresaId: EMP_A,
      codigo: "c2",
      ciclo: "c2",
      valor: 5,
      n: 3,
      respondidoEm: "2026-04-15T10:00:00Z",
    });

    // B só tem 1 ciclo — sem alertas possíveis.
    await criarCampanhaComRespostas({
      empresaId: EMP_B,
      codigo: "c1",
      ciclo: "c1",
      valor: 5,
      n: 3,
      respondidoEm: "2026-04-15T10:00:00Z",
    });

    const alertasA = await alertasRegressao(EMP_A);
    const alertasB = await alertasRegressao(EMP_B);

    expect(alertasA.length).toBeGreaterThanOrEqual(4); // 4 dimensões pesáveis no template
    for (const a of alertasA) {
      expect(a.cicloAnterior).toBe("c1");
      expect(a.cicloAtual).toBe("c2");
      expect(a.delta).toBeGreaterThan(0.5);
    }

    // Empresa B: sem dados suficientes (1 ciclo) → 0 alertas.
    expect(alertasB).toHaveLength(0);
  });
});
