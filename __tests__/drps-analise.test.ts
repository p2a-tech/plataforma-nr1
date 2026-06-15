import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes de integração da análise setorizada DRPS (Onda 5 · Dev A · §7).
 *
 * Exige Postgres local com migrations 0011-0017 aplicadas. Sem DB → skip.
 *
 * Casos:
 *   1. Empresa sem respostas → arrays vazios + resumo sem média.
 *   2. Empresa com 8 respostas em 2 setores (4+4):
 *        - cada setor com n_respostas = 4 → amostra_insuficiente=true
 *        - sem médias, classificacao=null.
 *      Empresa com 14 respostas em 2 setores (7+7):
 *        - cada setor com média e classificacao calculados.
 *   3. outliersSetoriais identifica setor com média > geral + threshold.
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMP_VAZIO = "emp_test_analise_vazio";
const EMP_AMOSTRA = "emp_test_analise_amostra";
const EMP_OUTLIER = "emp_test_analise_outlier";
const EMP_VALIDO = "emp_test_analise_valido";

describe.skipIf(!URL_ADMIN)("drps-analise · §7 análise setorizada", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let analisePorSetor: typeof import("@/lib/drps-analise")["analisePorSetor"];
  let analisePorContrato: typeof import("@/lib/drps-analise")["analisePorContrato"];
  let outliersSetoriais: typeof import("@/lib/drps-analise")["outliersSetoriais"];
  let resumoExecutivo: typeof import("@/lib/drps-analise")["resumoExecutivo"];
  let instrumentoId = "";
  let perguntasMap = new Map<string, string>(); // codigo → id

  /**
   * Insere uma resposta DRPS com itens diretos no banco (bypassa a lib pra
   * controlar os valores exatos). Usa sqlAdmin (sem RLS) — testes não estão
   * exercitando RLS aqui, isso já é coberto em drps.test.ts.
   */
  /**
   * Garante (idempotente) uma campanha 'avulso' pra empresa e devolve o id.
   * Necessário porque drps_resposta.campanha_id é NOT NULL (mig 0023) — este
   * helper faz INSERT direto (bypassa registrarResposta), então precisa
   * fornecer a campanha explicitamente.
   */
  async function garantirCampanhaAvulso(empresaId: string): Promise<string> {
    const [row] = await admin`
      insert into public.drps_campanha
        (empresa_id, instrumento_id, codigo, titulo, token, ciclo, ativo)
      values
        (${empresaId}, ${instrumentoId}, 'avulso', 'Avulso (sem campanha)',
         ${"tok_avulso_" + empresaId}, 'avulso', true)
      on conflict (empresa_id, codigo) do update set ativo = true
      returning id
    `;
    return row.id as string;
  }

  async function inserirResposta(
    empresaId: string,
    setor: string,
    forma: string,
    valoresLikert: number, // valor a aplicar em todas as 10 perguntas likert5_inverso
    marcador: string,
  ) {
    const campanhaId = await garantirCampanhaAvulso(empresaId);
    const [{ id }] = await admin`
      insert into public.drps_resposta
        (empresa_id, instrumento_id, campanha_id, marcador_anonimo, setor, funcao,
         tempo_empresa, forma_atuacao, canal)
      values
        (${empresaId}, ${instrumentoId}, ${campanhaId}, ${marcador}, ${setor}, 'Test',
         '1 a 3 anos', ${forma}, 'web')
      returning id
    `;
    // Insere 1 item por código likert5_inverso (Q5..Q10, Q13..Q16).
    const codigosLikert = ["Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Q13", "Q14", "Q15", "Q16"];
    for (const cod of codigosLikert) {
      const pid = perguntasMap.get(cod);
      if (!pid) continue;
      await admin`
        insert into public.drps_resposta_item (resposta_id, pergunta_id, valor_int)
        values (${id}, ${pid}, ${valoresLikert})
      `;
    }
    return id as string;
  }

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });

    // Empresas
    await admin`
      insert into public.empresas (id, nome) values
        (${EMP_VAZIO},   'Empresa Análise Vazio'),
        (${EMP_AMOSTRA}, 'Empresa Análise Amostra'),
        (${EMP_OUTLIER}, 'Empresa Análise Outlier'),
        (${EMP_VALIDO},  'Empresa Análise Valido')
      on conflict (id) do nothing
    `;

    // Recupera o instrumento global okebambo_v1 e o mapa de perguntas.
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
    perguntasMap = new Map(perguntas.map((p: { id: string; codigo: string }) => [p.codigo, p.id]));

    const mod = await import("@/lib/drps-analise");
    analisePorSetor = mod.analisePorSetor;
    analisePorContrato = mod.analisePorContrato;
    outliersSetoriais = mod.outliersSetoriais;
    resumoExecutivo = mod.resumoExecutivo;
  });

  afterAll(async () => {
    if (admin) {
      await admin`
        delete from public.drps_resposta
         where empresa_id in (${EMP_VAZIO}, ${EMP_AMOSTRA}, ${EMP_OUTLIER}, ${EMP_VALIDO})
      `;
      await admin`
        delete from public.empresas
         where id in (${EMP_VAZIO}, ${EMP_AMOSTRA}, ${EMP_OUTLIER}, ${EMP_VALIDO})
      `;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`
      delete from public.drps_resposta
       where empresa_id in (${EMP_VAZIO}, ${EMP_AMOSTRA}, ${EMP_OUTLIER}, ${EMP_VALIDO})
    `;
  });

  it("caso 1: empresa sem respostas → análises vazias e resumo sem média", async () => {
    const [setores, contratos, outliers, resumo] = await Promise.all([
      analisePorSetor(EMP_VAZIO),
      analisePorContrato(EMP_VAZIO),
      outliersSetoriais(EMP_VAZIO),
      resumoExecutivo(EMP_VAZIO),
    ]);
    expect(setores).toEqual([]);
    expect(contratos).toEqual([]);
    expect(outliers).toEqual([]);
    expect(resumo.n_total).toBe(0);
    expect(resumo.media_geral).toBeNull();
    expect(resumo.dimensao_mais_critica).toBeNull();
    expect(resumo.contrato_mais_critico).toBeNull();
  });

  it("caso 2: 8 respostas em 2 setores (4+4) → amostra_insuficiente em ambos", async () => {
    // 4 respostas Operacional / 4 Administrativa — n<7 em ambos.
    for (let i = 0; i < 4; i++) {
      await inserirResposta(EMP_AMOSTRA, "Operacional", "CLT", 4, `mk_op_${i}__________________________xx`);
    }
    for (let i = 0; i < 4; i++) {
      await inserirResposta(EMP_AMOSTRA, "Administrativa", "PJ", 2, `mk_ad_${i}__________________________xx`);
    }

    const setores = await analisePorSetor(EMP_AMOSTRA);
    expect(setores.length).toBe(2);
    for (const s of setores) {
      expect(s.n_respostas).toBe(4);
      expect(s.amostra_insuficiente).toBe(true);
      expect(s.media).toBeNull();
      expect(s.classificacao).toBeNull();
    }
  });

  it("caso 2b: 14 respostas em 2 setores (7+7) → médias e classificação válidas", async () => {
    for (let i = 0; i < 7; i++) {
      await inserirResposta(EMP_VALIDO, "Operacional", "CLT", 4, `mk_op_${i}__________________________yy`);
    }
    for (let i = 0; i < 7; i++) {
      await inserirResposta(EMP_VALIDO, "Administrativa", "CLT", 2, `mk_ad_${i}__________________________yy`);
    }
    const setores = await analisePorSetor(EMP_VALIDO);
    expect(setores.length).toBe(2);
    for (const s of setores) {
      expect(s.amostra_insuficiente).toBe(false);
      expect(s.n_respostas).toBe(7);
      expect(s.media).not.toBeNull();
      expect(s.classificacao).not.toBeNull();
    }
    const operacional = setores.find((s) => s.setor === "Operacional");
    const administrativa = setores.find((s) => s.setor === "Administrativa");
    expect(operacional?.media).toBeCloseTo(4, 1);
    expect(operacional?.classificacao).toBe("alto");
    expect(administrativa?.media).toBeCloseTo(2, 1);
    expect(administrativa?.classificacao).toBe("baixo");
  });

  it("caso 3: outliersSetoriais identifica setor com média muito acima da geral", async () => {
    // 7 respostas baixas (valor 1) em "Administrativa"
    for (let i = 0; i < 7; i++) {
      await inserirResposta(EMP_OUTLIER, "Administrativa", "CLT", 1, `mk_oadm_${i}________________________zz`);
    }
    // 7 respostas baixas (valor 1) em "Apoio"
    for (let i = 0; i < 7; i++) {
      await inserirResposta(EMP_OUTLIER, "Apoio", "CLT", 1, `mk_oap_${i}_________________________zz`);
    }
    // 7 respostas péssimas (valor 5) em "Operacional" — outlier alto
    for (let i = 0; i < 7; i++) {
      await inserirResposta(EMP_OUTLIER, "Operacional", "CLT", 5, `mk_oop_${i}_________________________zz`);
    }
    const outliers = await outliersSetoriais(EMP_OUTLIER);
    expect(outliers.length).toBeGreaterThanOrEqual(1);
    expect(outliers[0].setor).toBe("Operacional");
    expect(outliers[0].media).toBeCloseTo(5, 1);
    expect(outliers[0].desvio).toBeGreaterThan(1);
    expect(outliers[0].classificacao).toBe("alto");
  });
});
