import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import {
  parseCsv,
  sugerirMapeamento,
  validarLinha,
  importar,
  type InstrumentoCarregado,
} from "@/lib/drps-importador";

/**
 * Testes do importador DRPS (Onda 5 · Dev C · §9 BACKLOG_OKEBAMBO).
 *
 * Cobre:
 *   1) parseCsv com aspas, vírgulas dentro de valores e CRLF.
 *   2) sugerirMapeamento mapeia as 21 perguntas para o cabeçalho do
 *      questionário Okêbambo (BACKLOG §2).
 *   3) validarLinha rejeita escala fora do range.
 *   4) importar: dry-run não grava; rodada real grava e é idempotente.
 *
 * Os testes de (4) precisam de Postgres com migrations aplicadas — se
 * DATABASE_URL_ADMIN não está setado, esse bloco é skipado (mesma convenção
 * dos outros testes do projeto).
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;
const EMP = "emp_test_drps_importador";

/* -------------------------------------------------------------------------- */
/*  1) parseCsv                                                                */
/* -------------------------------------------------------------------------- */

describe("parseCsv · parsing CSV cru", () => {
  it("parseia CSV simples com header e duas linhas", () => {
    const csv = "a,b,c\n1,2,3\n4,5,6\n";
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      { a: "1", b: "2", c: "3" },
      { a: "4", b: "5", c: "6" },
    ]);
  });

  it("respeita aspas duplas com vírgula interna", () => {
    const csv = 'nome,obs\n"Silva, João","Tudo bem"\n"Maria","obs, com, vírgulas"\n';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].nome).toBe("Silva, João");
    expect(rows[0].obs).toBe("Tudo bem");
    expect(rows[1].obs).toBe("obs, com, vírgulas");
  });

  it("aceita aspas escapadas (\"\") dentro de valor aspado", () => {
    const csv = 'a,b\n"ele disse ""oi""","x"\n';
    const rows = parseCsv(csv);
    expect(rows[0].a).toBe('ele disse "oi"');
    expect(rows[0].b).toBe("x");
  });

  it("aceita CRLF e LF como quebra de linha", () => {
    const csvCrlf = "a,b\r\n1,2\r\n3,4\r\n";
    const csvLf = "a,b\n1,2\n3,4\n";
    expect(parseCsv(csvCrlf)).toEqual(parseCsv(csvLf));
  });

  it("preserva quebra de linha dentro de aspas", () => {
    const csv = 'a,b\n"linha 1\nlinha 2","x"\n';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].a).toBe("linha 1\nlinha 2");
  });

  it("pula linhas totalmente vazias", () => {
    const csv = "a,b\n1,2\n\n3,4\n";
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
  });

  it("retorna [] para string vazia", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("remove BOM no início do arquivo", () => {
    const csv = "﻿a,b\n1,2\n";
    const rows = parseCsv(csv);
    expect(rows).toEqual([{ a: "1", b: "2" }]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Fixture: instrumento Okêbambo (mock, sem DB)                               */
/* -------------------------------------------------------------------------- */

function instrumentoFake(): InstrumentoCarregado {
  // Replica a estrutura semântica do seed Okêbambo (migration 0012).
  const mk = (
    codigo: string,
    ordem: number,
    enunciado: string,
    tipo: string,
    opcoes: Array<{ label: string; ordem: number }> = [],
  ) => ({
    id: `pid-${codigo}`,
    instrumento_id: "iid",
    codigo,
    ordem,
    enunciado,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tipo: tipo as any,
    peso: 1,
    dim_id: null,
    opcoes: opcoes.map((o) => ({
      id: `oid-${codigo}-${o.ordem}`,
      ordem: o.ordem,
      label: o.label,
      valor: null,
    })),
  });

  return {
    instrumento: { id: "iid", codigo: "okebambo_v1", titulo: "Okêbambo" },
    perguntas: [
      mk("Q1", 1, "Em qual setor você atua?", "demografia"),
      mk("Q2", 2, "Qual sua função/cargo?", "demografia"),
      mk("Q3", 3, "Há quanto tempo você trabalha na empresa?", "demografia"),
      mk("Q4", 4, "Qual sua forma de atuação?", "demografia"),
      mk("Q5", 5, "Você considera adequada a quantidade de atendimentos/tarefas para o seu tempo de trabalho?", "likert5_inverso"),
      mk("Q6", 6, "Você tem intervalos suficientes entre os atendimentos?", "likert5_inverso"),
      mk("Q7", 7, "Você consegue realizar registros, relatórios e planejamentos sem pressa?", "likert5_inverso"),
      mk("Q8", 8, "O ambiente da clínica oferece condições adequadas (espaço, ruído, iluminação)?", "likert5_inverso"),
      mk("Q9", 9, "Você dispõe de privacidade e tranquilidade nos atendimentos?", "likert5_inverso"),
      mk("Q10", 10, "O ambiente é acolhedor e respeitoso entre profissionais?", "likert5_inverso"),
      mk("Q11", 11, "Com que frequência você lida com situações emocionalmente difíceis?", "likert3_freq"),
      mk("Q12", 12, "Com que frequência você sente cansaço emocional?", "likert3_freq"),
      mk("Q13", 13, "Você tem suporte para discutir casos difíceis?", "likert5_inverso"),
      mk("Q14", 14, "Você sente apoio da equipe quando precisa?", "likert5_inverso"),
      mk("Q15", 15, "A comunicação entre profissionais é clara e respeitosa?", "likert5_inverso"),
      mk("Q16", 16, "Você se sente confortável para falar sobre dificuldades?", "likert5_inverso"),
      mk("Q17", 17, "Você sente que o trabalho impactou sua saúde emocional/mental?", "impacto4"),
      mk("Q18", 18, "Você já se sentiu esgotado emocionalmente?", "esgotamento5"),
      mk("Q19", 19, "Na sua percepção, qual o maior gerador de estresse ou dificuldade no trabalho?", "multi_choice", [
        { ordem: 1, label: "Agenda e agendamentos" },
        { ordem: 2, label: "Conflitos entre profissionais" },
        { ordem: 3, label: "Ruído ou interrupções" },
        { ordem: 4, label: "Falta de organização processual" },
        { ordem: 5, label: "Falta de suporte da coordenação" },
        { ordem: 6, label: "Falta de tempo para registros clínicos" },
        { ordem: 7, label: "Falta de privacidade" },
        { ordem: 8, label: "Outro (especificar no comentário)" },
      ]),
      mk("Q20", 20, "O que você acha que poderia melhorar para reduzir estresse?", "multi_choice", [
        { ordem: 1, label: "Ajustes na agenda" },
        { ordem: 2, label: "Treinamento para manejo de crises" },
      ]),
      mk("Q21", 21, "Você gostaria de acrescentar observações livres?", "texto"),
    ],
  };
}

/* -------------------------------------------------------------------------- */
/*  2) sugerirMapeamento                                                       */
/* -------------------------------------------------------------------------- */

describe("sugerirMapeamento · heurística substring", () => {
  // Cabeçalho do CSV real do Forms Okêbambo, como descrito no BACKLOG §2.
  const HEADERS = [
    "Carimbo de data/hora",
    "Em qual setor você atua?",
    "Qual sua função/cargo?",
    "Há quanto tempo você trabalha na empresa?",
    "Qual sua forma de atuação?",
    "Você considera adequada a quantidade de atendimentos/tarefas para o seu tempo de trabalho?",
    "Você tem intervalos suficientes entre os atendimentos?",
    "Você consegue realizar registros, relatórios e planejamentos sem pressa?",
    "O ambiente da clínica oferece condições adequadas (espaço, ruído, iluminação)?",
    "Você dispõe de privacidade e tranquilidade nos atendimentos?",
    "O ambiente é acolhedor e respeitoso entre profissionais?",
    "Com que frequência você lida com situações emocionalmente difíceis?",
    "Com que frequência você sente cansaço emocional?",
    "Você tem suporte para discutir casos difíceis?",
    "Você sente apoio da equipe quando precisa?",
    "A comunicação entre profissionais é clara e respeitosa?",
    "Você se sente confortável para falar sobre dificuldades?",
    "Você sente que o trabalho impactou sua saúde emocional/mental?",
    "Você já se sentiu esgotado emocionalmente?",
    "Na sua percepção, qual o maior gerador de estresse ou dificuldade no trabalho?",
    "O que você acha que poderia melhorar para reduzir estresse?",
    "Você gostaria de acrescentar observações livres?",
  ];

  it("ignora Carimbo de data/hora", () => {
    const map = sugerirMapeamento(HEADERS, instrumentoFake());
    expect(map["Carimbo de data/hora"]).toBeNull();
  });

  it("mapeia as 21 perguntas Q1..Q21", () => {
    const map = sugerirMapeamento(HEADERS, instrumentoFake());
    const esperadas: Record<string, string> = {
      "Em qual setor você atua?": "Q1",
      "Qual sua função/cargo?": "Q2",
      "Há quanto tempo você trabalha na empresa?": "Q3",
      "Qual sua forma de atuação?": "Q4",
      "Você considera adequada a quantidade de atendimentos/tarefas para o seu tempo de trabalho?": "Q5",
      "Você tem intervalos suficientes entre os atendimentos?": "Q6",
      "Você consegue realizar registros, relatórios e planejamentos sem pressa?": "Q7",
      "O ambiente da clínica oferece condições adequadas (espaço, ruído, iluminação)?": "Q8",
      "Você dispõe de privacidade e tranquilidade nos atendimentos?": "Q9",
      "O ambiente é acolhedor e respeitoso entre profissionais?": "Q10",
      "Com que frequência você lida com situações emocionalmente difíceis?": "Q11",
      "Com que frequência você sente cansaço emocional?": "Q12",
      "Você tem suporte para discutir casos difíceis?": "Q13",
      "Você sente apoio da equipe quando precisa?": "Q14",
      "A comunicação entre profissionais é clara e respeitosa?": "Q15",
      "Você se sente confortável para falar sobre dificuldades?": "Q16",
      "Você sente que o trabalho impactou sua saúde emocional/mental?": "Q17",
      "Você já se sentiu esgotado emocionalmente?": "Q18",
      "Na sua percepção, qual o maior gerador de estresse ou dificuldade no trabalho?": "Q19",
      "O que você acha que poderia melhorar para reduzir estresse?": "Q20",
      "Você gostaria de acrescentar observações livres?": "Q21",
    };

    for (const [header, codigo] of Object.entries(esperadas)) {
      expect(map[header], `header "${header}" deveria mapear para ${codigo}`)
        .toBe(codigo);
    }

    // E cada codigo só aparece uma vez (sem colisão)
    const codigosUsados = Object.values(map).filter((v) => v !== null);
    const unicos = new Set(codigosUsados);
    expect(unicos.size).toBe(codigosUsados.length);
    expect(unicos.size).toBe(21);
  });

  it("ignora colunas de email/score", () => {
    const map = sugerirMapeamento(
      ["Endereço de e-mail", "Pontuação", "Em qual setor você atua?"],
      instrumentoFake(),
    );
    expect(map["Endereço de e-mail"]).toBeNull();
    expect(map["Pontuação"]).toBeNull();
    expect(map["Em qual setor você atua?"]).toBe("Q1");
  });
});

/* -------------------------------------------------------------------------- */
/*  3) validarLinha                                                            */
/* -------------------------------------------------------------------------- */

describe("validarLinha · conversão Likert + range", () => {
  const inst = instrumentoFake();
  const mapeamento = {
    "Setor": "Q1",
    "Q5": "Q5",
    "Q11": "Q11",
    "Q17": "Q17",
    "Q18": "Q18",
    "Q19": "Q19",
    "Q21": "Q21",
  };

  it("converte rótulos Likert 1-5 (Sempre → 1, Nunca → 5)", () => {
    const linha = { Setor: "Operacional", Q5: "Sempre" };
    const r = validarLinha(linha, mapeamento, inst);
    expect(r.ok).toBe(true);
    expect(r.setor).toBe("Operacional");
    const q5 = r.itens.find((i) => i.pergunta_codigo === "Q5");
    expect(q5?.valor_int).toBe(1);
  });

  it("converte Likert 1-3 (Frequentemente → 3)", () => {
    const linha = { Q11: "Frequentemente" };
    const r = validarLinha(linha, mapeamento, inst);
    const q11 = r.itens.find((i) => i.pergunta_codigo === "Q11");
    expect(q11?.valor_int).toBe(3);
  });

  it("converte Impacto 1-4 (Significativamente → 4)", () => {
    const linha = { Q17: "Significativamente" };
    const r = validarLinha(linha, mapeamento, inst);
    const q17 = r.itens.find((i) => i.pergunta_codigo === "Q17");
    expect(q17?.valor_int).toBe(4);
  });

  it("converte Esgotamento 1-5 (Sempre → 5)", () => {
    const linha = { Q18: "Sempre" };
    const r = validarLinha(linha, mapeamento, inst);
    const q18 = r.itens.find((i) => i.pergunta_codigo === "Q18");
    expect(q18?.valor_int).toBe(5);
  });

  it("rejeita escala fora do range (texto desconhecido)", () => {
    const linha = { Q5: "FrequênciaInexistente" };
    const r = validarLinha(linha, mapeamento, inst);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.includes("Q5"))).toBe(true);
  });

  it("rejeita inteiro fora do range pra likert3_freq", () => {
    const linha = { Q11: "9" }; // Likert3 só aceita 1..3
    const r = validarLinha(linha, mapeamento, inst);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.includes("Q11"))).toBe(true);
  });

  it("multi_choice casa tokens com options.label e sobra vira texto", () => {
    const linha = {
      Q19: "Agenda e agendamentos, Falta de privacidade, Outro tema fora",
    };
    const r = validarLinha(linha, mapeamento, inst);
    const q19 = r.itens.find((i) => i.pergunta_codigo === "Q19");
    expect(q19?.opcoes_ids?.length).toBe(2);
    expect(q19?.valor_texto).toContain("Outro tema fora");
  });

  it("texto livre passa direto (Q21)", () => {
    const linha = { Q21: "obs livre xpto" };
    const r = validarLinha(linha, mapeamento, inst);
    const q21 = r.itens.find((i) => i.pergunta_codigo === "Q21");
    expect(q21?.valor_texto).toBe("obs livre xpto");
  });

  it("marcador anônimo é determinístico (mesmo input → mesmo marcador)", () => {
    const linha = { Q5: "Sempre", Q11: "Raramente" };
    const a = validarLinha(linha, mapeamento, inst);
    const b = validarLinha(linha, mapeamento, inst);
    expect(a.marcador).toBe(b.marcador);
    expect(a.marcador).toHaveLength(32);
  });

  it("marcador difere se linha muda", () => {
    const a = validarLinha({ Q5: "Sempre" }, mapeamento, inst);
    const b = validarLinha({ Q5: "Nunca" }, mapeamento, inst);
    expect(a.marcador).not.toBe(b.marcador);
  });
});

/* -------------------------------------------------------------------------- */
/*  4) importar (integração com DB · skipped sem DATABASE_URL_ADMIN)           */
/* -------------------------------------------------------------------------- */

describe.skipIf(!URL_ADMIN)("importar · integração DB (dry-run + idempotência)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let templateId: string;

  // Headers reais do Forms — cobrem 5 perguntas (Q1, Q5, Q11, Q19, Q21).
  const CSV = [
    [
      "Carimbo de data/hora",
      "Em qual setor você atua?",
      "Você considera adequada a quantidade de atendimentos/tarefas para o seu tempo de trabalho?",
      "Com que frequência você lida com situações emocionalmente difíceis?",
      "Na sua percepção, qual o maior gerador de estresse ou dificuldade no trabalho?",
      "Você gostaria de acrescentar observações livres?",
    ].join(","),
    [
      "2026-06-01 10:00:00",
      "Operacional",
      "Sempre",
      "Frequentemente",
      "\"Agenda e agendamentos, Ruído ou interrupções\"",
      "tudo certo",
    ].join(","),
    [
      "2026-06-01 11:00:00",
      "Administrativa",
      "Nunca",
      "Raramente",
      "\"Falta de privacidade\"",
      "",
    ].join(","),
  ].join("\n");

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });
    await admin`
      insert into public.empresas (id, nome) values (${EMP}, 'Empresa Importador Test')
      on conflict (id) do nothing
    `;
    const [row] = await admin<{ id: string }[]>`
      select id from public.drps_instrumento
       where empresa_id is null and codigo = 'okebambo_v1' and ativo = true
       limit 1
    `;
    templateId = row.id;
  });

  afterAll(async () => {
    if (admin) {
      await admin`delete from public.drps_resposta where empresa_id = ${EMP}`;
      await admin`delete from public.empresas where id = ${EMP}`;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.drps_resposta where empresa_id = ${EMP}`;
  });

  it("dry-run NÃO grava no banco", async () => {
    const headers = parseCsv(CSV).length
      ? Object.keys(parseCsv(CSV)[0])
      : [];
    const inst = await loadInst(admin, templateId);
    const map = sugerirMapeamento(headers, inst);

    const r = await importar(EMP, CSV, {
      mapeamento: map,
      instrumento_id: templateId,
      dryRun: true,
    });
    expect(r.dry_run).toBe(true);
    expect(r.total_lidas).toBe(2);
    expect(r.sucesso).toBe(2);

    const [{ n }] = await admin<{ n: number }[]>`
      select count(*)::int as n from public.drps_resposta where empresa_id = ${EMP}
    `;
    expect(n).toBe(0);
  });

  it("importação real grava e é idempotente em rerun", async () => {
    const headers = Object.keys(parseCsv(CSV)[0]);
    const inst = await loadInst(admin, templateId);
    const map = sugerirMapeamento(headers, inst);

    const r1 = await importar(EMP, CSV, {
      mapeamento: map,
      instrumento_id: templateId,
      dryRun: false,
    });
    expect(r1.sucesso).toBe(2);

    const [{ n: n1 }] = await admin<{ n: number }[]>`
      select count(*)::int as n from public.drps_resposta where empresa_id = ${EMP}
    `;
    expect(n1).toBe(2);

    // Rerun: marcador é determinístico → upsert, mantém 2 linhas
    const r2 = await importar(EMP, CSV, {
      mapeamento: map,
      instrumento_id: templateId,
      dryRun: false,
    });
    expect(r2.sucesso).toBe(2);

    const [{ n: n2 }] = await admin<{ n: number }[]>`
      select count(*)::int as n from public.drps_resposta where empresa_id = ${EMP}
    `;
    expect(n2).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadInst(admin: any, instrumentoId: string): Promise<InstrumentoCarregado> {
  const inst = await admin<{ id: string; codigo: string; titulo: string }[]>`
    select id, codigo, titulo from public.drps_instrumento where id = ${instrumentoId}
  `;
  const perguntas = await admin<
    { id: string; instrumento_id: string; ordem: number; codigo: string; enunciado: string; tipo: string }[]
  >`
    select id, instrumento_id, ordem, codigo, enunciado, tipo
      from public.drps_pergunta where instrumento_id = ${instrumentoId}
      order by ordem
  `;
  const opcoes = await admin<
    { id: string; pergunta_id: string; ordem: number; label: string; valor: number | null }[]
  >`
    select o.id, o.pergunta_id, o.ordem, o.label, o.valor
      from public.drps_opcao o
      join public.drps_pergunta p on p.id = o.pergunta_id
     where p.instrumento_id = ${instrumentoId}
  `;
  const byPergunta = new Map<string, typeof opcoes>();
  for (const o of opcoes) {
    const arr = byPergunta.get(o.pergunta_id) ?? [];
    arr.push(o);
    byPergunta.set(o.pergunta_id, arr);
  }
  return {
    instrumento: inst[0],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    perguntas: perguntas.map((p: any) => ({
      ...p,
      peso: 1,
      dim_id: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      opcoes: (byPergunta.get(p.id) ?? []).map((o: any) => ({
        id: o.id,
        ordem: o.ordem,
        label: o.label,
        valor: o.valor,
      })),
    })),
  };
}
