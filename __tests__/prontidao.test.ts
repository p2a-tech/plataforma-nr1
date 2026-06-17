import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes de integração do placar de prontidão NR-1 (Onda 9 · Dev B).
 *
 * Exige Postgres local com as migrations 0003/0004 (governança/LGPD),
 * 0011-0017 (DRPS/catálogo NR-1) e 0014 (plano_acao). Sem DATABASE_URL_ADMIN
 * (CI sem DB) → skip.
 *
 * Cobre:
 *   1. Empresa vazia → score baixo, itens-chave pendentes.
 *   2. Empresa seedada (DRPS 7+7 + plano de ação + colaboradores) → score sobe,
 *      DRPS aplicado e risco mapeado viram ok, plano de ação ok.
 *   3. Isolamento por empresa: a avaliação de A não enxerga os dados de B.
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMP_VAZIO = "emp_test_prontidao_vazio";
const EMP_CHEIO = "emp_test_prontidao_cheio";

describe.skipIf(!URL_ADMIN)("prontidao · placar de auditoria NR-1", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let avaliarProntidao: typeof import("@/lib/prontidao")["avaliarProntidao"];
  let calcularScore: typeof import("@/lib/prontidao")["calcularScore"];
  let instrumentoId = "";
  let perguntasMap = new Map<string, string>(); // codigo → id
  let fatorId = "";

  async function garantirCampanhaAvulso(empresaId: string): Promise<string> {
    const [row] = await admin`
      insert into public.drps_campanha
        (empresa_id, instrumento_id, codigo, titulo, token, ciclo, ativo)
      values
        (${empresaId}, ${instrumentoId}, 'avulso', 'Avulso (sem campanha)',
         ${"tok_prontidao_" + empresaId}, 'avulso', true)
      on conflict (empresa_id, codigo) do update set ativo = true
      returning id
    `;
    return row.id as string;
  }

  /** Insere uma resposta DRPS com 10 itens likert5_inverso de igual valor. */
  async function inserirResposta(
    empresaId: string,
    setor: string,
    valorLikert: number,
    marcador: string,
  ) {
    const campanhaId = await garantirCampanhaAvulso(empresaId);
    const [{ id }] = await admin`
      insert into public.drps_resposta
        (empresa_id, instrumento_id, campanha_id, marcador_anonimo, setor, funcao,
         tempo_empresa, forma_atuacao, canal)
      values
        (${empresaId}, ${instrumentoId}, ${campanhaId}, ${marcador}, ${setor}, 'Test',
         '1 a 3 anos', 'CLT', 'web')
      returning id
    `;
    const codigosLikert = ["Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Q13", "Q14", "Q15", "Q16"];
    for (const cod of codigosLikert) {
      const pid = perguntasMap.get(cod);
      if (!pid) continue;
      await admin`
        insert into public.drps_resposta_item (resposta_id, pergunta_id, valor_int)
        values (${id}, ${pid}, ${valorLikert})
      `;
    }
    return id as string;
  }

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 4 });

    await admin`
      insert into public.empresas (id, nome) values
        (${EMP_VAZIO}, 'Empresa Prontidão Vazio'),
        (${EMP_CHEIO}, 'Empresa Prontidão Cheio')
      on conflict (id) do nothing
    `;

    const [inst] = await admin<{ id: string }[]>`
      select id from public.drps_instrumento
       where empresa_id is null and codigo = 'okebambo_v1'
       limit 1
    `;
    if (!inst) throw new Error("template okebambo_v1 não encontrado");
    instrumentoId = inst.id;

    const perguntas = await admin<{ id: string; codigo: string }[]>`
      select id, codigo from public.drps_pergunta where instrumento_id = ${instrumentoId}
    `;
    perguntasMap = new Map(
      perguntas.map((p: { id: string; codigo: string }) => [p.codigo, p.id]),
    );

    // Um fator NR-1 qualquer para anexar o plano de ação (FK NOT NULL).
    const [fator] = await admin<{ id: string }[]>`
      select id from public.fator_nr1 limit 1
    `;
    if (!fator) throw new Error("nenhum fator_nr1 — aplique as migrations do Dev A");
    fatorId = fator.id;

    const mod = await import("@/lib/prontidao");
    avaliarProntidao = mod.avaliarProntidao;
    calcularScore = mod.calcularScore;
  });

  async function limpar() {
    for (const emp of [EMP_VAZIO, EMP_CHEIO]) {
      await admin`delete from public.plano_acao where empresa_id = ${emp}`;
      await admin`delete from public.drps_resposta where empresa_id = ${emp}`;
      await admin`delete from public.colaborador_registro where empresa_id = ${emp}`;
    }
  }

  afterAll(async () => {
    if (admin) {
      await limpar();
      await admin`delete from public.drps_campanha where empresa_id in (${EMP_VAZIO}, ${EMP_CHEIO})`;
      await admin`delete from public.empresas where id in (${EMP_VAZIO}, ${EMP_CHEIO})`;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(limpar);

  it("calcularScore: pondera ok=1, atenção=0.5; lista vazia → 0", () => {
    expect(calcularScore([])).toBe(0);
    expect(
      calcularScore([
        { chave: "a", rotulo: "", status: "ok", detalhe: "", href: "" },
        { chave: "b", rotulo: "", status: "atencao", detalhe: "", href: "" },
        { chave: "c", rotulo: "", status: "pendente", detalhe: "", href: "" },
        { chave: "d", rotulo: "", status: "pendente", detalhe: "", href: "" },
      ]),
    ).toBe(Math.round((100 * (1 + 0.5)) / 4)); // = 38
  });

  it("caso 1: empresa vazia → score baixo + itens-chave pendentes", async () => {
    const { score, itens } = await avaliarProntidao(EMP_VAZIO);

    // 7 itens fixos no checklist.
    expect(itens).toHaveLength(7);
    const byChave = new Map(itens.map((i) => [i.chave, i]));

    expect(byChave.get("drps_aplicado")?.status).toBe("pendente");
    expect(byChave.get("risco_mapeado")?.status).toBe("pendente");
    expect(byChave.get("pgr_assinado")?.status).toBe("pendente"); // nunca assinado

    // Score baixo (nenhum dado de escuta/plano). Bem abaixo do "pronto" (85).
    expect(score).toBeLessThan(60);

    // Todo item tem href de "resolver".
    for (const i of itens) {
      expect(i.href.startsWith("/")).toBe(true);
    }
  });

  it("caso 2: empresa seedada → score sobe; DRPS, risco e plano viram ok", async () => {
    const vazio = await avaliarProntidao(EMP_CHEIO);

    // Seed: 7+7 respostas em 2 setores (amostra válida k≥7), valores distintos
    // para gerar média/classificação.
    for (let i = 0; i < 7; i++) {
      await inserirResposta(EMP_CHEIO, "Operacional", 4, `mk_pr_op_${i}_______________________ab`);
    }
    for (let i = 0; i < 7; i++) {
      await inserirResposta(EMP_CHEIO, "Administrativa", 2, `mk_pr_ad_${i}_______________________ab`);
    }

    // Plano de ação sem prazo vencido.
    await admin`
      insert into public.plano_acao
        (empresa_id, fator_id, classificacao, programa, titulo_custom,
         responsavel, prazo, status, criado_por)
      values
        (${EMP_CHEIO}, ${fatorId}, 'moderado', 'prevencionista',
         'Plano de teste', 'SESMT', current_date + 30, 'em_andamento', 'teste')
    `;

    // Colaborador ativo → eSocial por CPF disponível.
    await admin`
      insert into public.colaborador_registro
        (empresa_id, cpf, nome, setor, ativo)
      values
        (${EMP_CHEIO}, '52998224725', 'Fulano Teste', 'Operacional', true)
      on conflict do nothing
    `;

    const cheio = await avaliarProntidao(EMP_CHEIO);
    const byChave = new Map(cheio.itens.map((i) => [i.chave, i]));

    expect(byChave.get("drps_aplicado")?.status).toBe("ok");
    expect(byChave.get("risco_mapeado")?.status).toBe("ok");
    expect(byChave.get("plano_acao")?.status).toBe("ok");
    expect(byChave.get("esocial_s2240")?.status).toBe("ok");

    // Score subiu vs. empresa recém-criada (sem dados).
    expect(cheio.score).toBeGreaterThan(vazio.score);
  });

  it("caso 3: isolamento — dados de CHEIO não vazam para VAZIO", async () => {
    // Seed só em CHEIO.
    for (let i = 0; i < 7; i++) {
      await inserirResposta(EMP_CHEIO, "Operacional", 4, `mk_iso_${i}_________________________ab`);
    }

    const [cheio, vazio] = await Promise.all([
      avaliarProntidao(EMP_CHEIO),
      avaliarProntidao(EMP_VAZIO),
    ]);

    const drpsCheio = cheio.itens.find((i) => i.chave === "drps_aplicado");
    const drpsVazio = vazio.itens.find((i) => i.chave === "drps_aplicado");

    expect(drpsCheio?.status).toBe("ok");
    // VAZIO continua sem nenhuma resposta DRPS → pendente.
    expect(drpsVazio?.status).toBe("pendente");
    expect(vazio.score).toBeLessThan(cheio.score);
  });
});
