import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes do relatório executivo DRPS em PDF (Onda 8 · Dev C).
 *
 * Exige Postgres local com migrations do DRPS aplicadas (instrumento global
 * okebambo_v1). Sem DB → skip (mesma convenção de drps-analise.test.ts).
 *
 * Não parseamos o PDF: validamos só os magic bytes (%PDF), que a geração não
 * lança, que com dados o buffer é não-vazio, e o isolamento por empresa.
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMP_VAZIO = "emp_test_drpspdf_vazio";
const EMP_DADOS = "emp_test_drpspdf_dados";
const EMP_OUTRO = "emp_test_drpspdf_outro";

/** Bytes iniciais de todo PDF válido: "%PDF". */
function comecaComPdf(buf: Buffer): boolean {
  return buf.subarray(0, 4).toString("latin1") === "%PDF";
}

describe.skipIf(!URL_ADMIN)("drps-pdf · relatório executivo", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let gerarRelatorioDrps: typeof import("@/lib/drps-pdf")["gerarRelatorioDrps"];
  let instrumentoId = "";
  let perguntasMap = new Map<string, string>();

  async function garantirCampanha(empresaId: string): Promise<string> {
    const [row] = await admin`
      insert into public.drps_campanha
        (empresa_id, instrumento_id, codigo, titulo, token, ciclo, ativo)
      values
        (${empresaId}, ${instrumentoId}, 'avulso', 'Avulso (sem campanha)',
         ${"tok_pdf_" + empresaId}, '2026-01', true)
      on conflict (empresa_id, codigo) do update set ativo = true
      returning id
    `;
    return row.id as string;
  }

  async function inserirResposta(
    empresaId: string,
    setor: string,
    forma: string,
    valor: number,
    marcador: string,
  ) {
    const campanhaId = await garantirCampanha(empresaId);
    const [{ id }] = await admin`
      insert into public.drps_resposta
        (empresa_id, instrumento_id, campanha_id, marcador_anonimo, setor, funcao,
         tempo_empresa, forma_atuacao, canal)
      values
        (${empresaId}, ${instrumentoId}, ${campanhaId}, ${marcador}, ${setor}, 'Test',
         '1 a 3 anos', ${forma}, 'web')
      returning id
    `;
    const codigos = ["Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Q13", "Q14", "Q15", "Q16"];
    for (const cod of codigos) {
      const pid = perguntasMap.get(cod);
      if (!pid) continue;
      await admin`
        insert into public.drps_resposta_item (resposta_id, pergunta_id, valor_int)
        values (${id}, ${pid}, ${valor})
      `;
    }
    return id as string;
  }

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });

    await admin`
      insert into public.empresas (id, nome) values
        (${EMP_VAZIO}, 'Empresa DRPS PDF Vazio'),
        (${EMP_DADOS}, 'Empresa DRPS PDF Dados'),
        (${EMP_OUTRO}, 'Empresa DRPS PDF Outro')
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

    const mod = await import("@/lib/drps-pdf");
    gerarRelatorioDrps = mod.gerarRelatorioDrps;
  });

  afterAll(async () => {
    if (admin) {
      await admin`
        delete from public.drps_resposta
         where empresa_id in (${EMP_VAZIO}, ${EMP_DADOS}, ${EMP_OUTRO})
      `;
      await admin`
        delete from public.drps_campanha
         where empresa_id in (${EMP_VAZIO}, ${EMP_DADOS}, ${EMP_OUTRO})
      `;
      await admin`
        delete from public.empresas
         where id in (${EMP_VAZIO}, ${EMP_DADOS}, ${EMP_OUTRO})
      `;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`
      delete from public.drps_resposta
       where empresa_id in (${EMP_VAZIO}, ${EMP_DADOS}, ${EMP_OUTRO})
    `;
  });

  it("empresa sem dados → PDF válido (magic bytes %PDF) sem throw", async () => {
    const buf = await gerarRelatorioDrps(EMP_VAZIO);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(comecaComPdf(buf)).toBe(true);
  });

  it("empresa com dados → buffer não-vazio e PDF válido", async () => {
    // 7 respostas em 2 setores → amostra válida (k ≥ 7).
    for (let i = 0; i < 7; i++) {
      await inserirResposta(EMP_DADOS, "Operacional", "CLT", 4, `pdf_op_${i}________________________aa`);
    }
    for (let i = 0; i < 7; i++) {
      await inserirResposta(EMP_DADOS, "Administrativa", "PJ", 5, `pdf_ad_${i}________________________aa`);
    }
    const buf = await gerarRelatorioDrps(EMP_DADOS, { empresaNome: "Empresa DRPS PDF Dados" });
    expect(comecaComPdf(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("isolamento por empresa: relatório de uma empresa não usa dados de outra", async () => {
    // EMP_DADOS recebe muitas respostas; EMP_OUTRO fica vazia.
    for (let i = 0; i < 14; i++) {
      await inserirResposta(EMP_DADOS, "Operacional", "CLT", 5, `pdf_iso_${i}_______________________bb`);
    }
    const [comDados, vazio] = await Promise.all([
      gerarRelatorioDrps(EMP_DADOS),
      gerarRelatorioDrps(EMP_OUTRO),
    ]);
    // Ambos válidos, mas a empresa com dados gera um documento maior
    // (tabelas de setor/dimensão), provando que não houve vazamento cruzado:
    // se EMP_OUTRO usasse dados de EMP_DADOS, seriam de tamanho comparável.
    expect(comecaComPdf(comDados)).toBe(true);
    expect(comecaComPdf(vazio)).toBe(true);
    expect(comDados.length).toBeGreaterThan(vazio.length);
  });
});
