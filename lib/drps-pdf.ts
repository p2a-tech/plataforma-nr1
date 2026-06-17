import "server-only";
import PDFDocument from "pdfkit";
import { sql } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";
import {
  analisePorSetor,
  analisePorContrato,
  outliersSetoriais,
  resumoExecutivo,
  type AnalisePorSetor,
  type AnalisePorContrato,
  type Outlier,
  type ResumoExecutivo,
} from "@/lib/drps-analise";
import { serieDimensoes, type PontoSerie } from "@/lib/drps-historico";
import { rotuloClassificacao, type Classificacao } from "@/lib/drps-escoragem";

/**
 * Relatório executivo do DRPS em PDF · Onda 8 (Dev C).
 *
 * Documento A4 executivo, SEM PII (anônimo por construção · k-anonimato ≥ 7),
 * consumindo APENAS as libs de análise existentes (drps-analise / drps-historico)
 * — nenhum cálculo é reescrito aqui. Mesmo padrão visual/técnico de lib/pgr-pdf.ts
 * (pdfkit já habilitado em produção via serverComponentsExternalPackages).
 *
 * Seções:
 *   - Cabeçalho institucional (PrevIA · Relatório DRPS · empresa · data · NR-1)
 *   - Resumo executivo (média geral, n respondentes, dimensão/contrato mais
 *     crítico, classificação geral)
 *   - Tabela por dimensão NR-1 (média ponderada + classificação rotulada)
 *   - Tabela por setor (k-anonimato: n<7 → "amostra insuficiente")
 *   - Risco por forma de contratação (destaque MPT se não-CLT > CLT)
 *   - Outliers setoriais
 *   - Evolução por dimensão ao longo dos ciclos (tabela)
 *   - Rodapé (k-anonimato ≥ 7, LGPD, anônimo por construção, data)
 *
 * Robustez: empresa sem dados → PDF válido (capa + "sem amostra"), sem throw.
 */

/* -------------------------------------------------------------------------- */
/*  Paleta (mesma de pgr-pdf.ts)                                                */
/* -------------------------------------------------------------------------- */

const COR_INK = "#0B1F3A";
const COR_MUTED = "#5B6B82";
const COR_IA = "#00C2D1";
const COR_HUMANO = "#FF6B35";
const COR_OK = "#27AE60";
const COR_ALERTA = "#E5484D";
const COR_AMBAR = "#FFB020";

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                       */
/* -------------------------------------------------------------------------- */

export interface DrpsPdfOpts {
  /** Nome da empresa (se não vier, é resolvido de public.empresas). */
  empresaNome?: string;
  /** Data de referência do relatório (default: agora). */
  geradoEm?: Date;
}

/** Dados consolidados das libs de análise (todos tenant-scoped). */
interface DadosRelatorio {
  empresaNome: string;
  resumo: ResumoExecutivo;
  setores: AnalisePorSetor[];
  contratos: AnalisePorContrato[];
  outliers: Outlier[];
  serie: PontoSerie[];
}

/* -------------------------------------------------------------------------- */
/*  Helpers de classificação / formatação                                      */
/* -------------------------------------------------------------------------- */

/**
 * Classifica uma média na convenção PrevIA (1 baixo → 5 alto). Reutiliza os
 * mesmos limiares do drps-escoragem para coerência com o restante do produto.
 */
function classificarMedia(m: number): Classificacao {
  if (m <= 2.0) return "baixo";
  if (m <= 3.5) return "moderado";
  return "alto";
}

function corClassificacao(c: Classificacao | null): string {
  switch (c) {
    case "alto":
      return COR_ALERTA;
    case "moderado":
      return COR_AMBAR;
    case "baixo":
      return COR_OK;
    default:
      return COR_MUTED;
  }
}

function fmtMedia(m: number | null | undefined): string {
  return m != null ? m.toFixed(2) : "—";
}

function fmtData(d: Date): string {
  return d.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/* -------------------------------------------------------------------------- */
/*  Coleta de dados (uma única passada tenant-scoped)                          */
/* -------------------------------------------------------------------------- */

async function coletarDados(
  empresaId: string,
  opts: DrpsPdfOpts,
): Promise<DadosRelatorio> {
  // Nome da empresa: usa o fornecido ou resolve no banco (dentro do escopo
  // de empresa → RLS). Nunca quebra: cai em "(empresa)" se não encontrar.
  const empresaNome =
    opts.empresaNome ??
    (await withEmpresa(empresaId, async () => {
      const [row] = await sql<{ nome: string | null }[]>`
        select nome from public.empresas where id = ${empresaId} limit 1
      `;
      return row?.nome ?? "(empresa)";
    }));

  const [resumo, setores, contratos, outliers, serie] = await Promise.all([
    resumoExecutivo(empresaId),
    analisePorSetor(empresaId),
    analisePorContrato(empresaId),
    outliersSetoriais(empresaId),
    serieDimensoes(empresaId),
  ]);

  return { empresaNome, resumo, setores, contratos, outliers, serie };
}

/* -------------------------------------------------------------------------- */
/*  Entry point                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Gera o relatório executivo DRPS em PDF e devolve um Buffer
 * (pronto para `new Response(buffer)`).
 */
export async function gerarRelatorioDrps(
  empresaId: string,
  opts: DrpsPdfOpts = {},
): Promise<Buffer> {
  const geradoEm = opts.geradoEm ?? new Date();
  const dados = await coletarDados(empresaId, opts);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      info: {
        Title: `Relatório DRPS · ${dados.empresaNome}`,
        Author: "PrevIA · P2A Tech",
        Subject: "Relatório executivo do Diagnóstico de Riscos Psicossociais (NR-1)",
        Keywords: "NR-1, DRPS, riscos psicossociais, relatório executivo",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    cabecalho(doc, dados.empresaNome, geradoEm);

    let y = 130;
    y = secaoResumo(doc, dados.resumo, y);
    y = secaoPorDimensao(doc, dados, y);
    y = secaoPorSetor(doc, dados.setores, y);
    y = secaoPorContrato(doc, dados.contratos, y);
    y = secaoOutliers(doc, dados.outliers, y);
    secaoEvolucao(doc, dados.serie, y);

    rodape(doc, geradoEm);
    doc.end();
  });
}

/* -------------------------------------------------------------------------- */
/*  Seções                                                                      */
/* -------------------------------------------------------------------------- */

function secaoResumo(
  doc: PDFKit.PDFDocument,
  resumo: ResumoExecutivo,
  y: number,
): number {
  y = secao(doc, "1. Resumo executivo", y);

  if (resumo.n_total === 0) {
    y = paragrafo(
      doc,
      "Ainda não há respostas DRPS registradas para esta empresa. Assim que houver volume suficiente (k-anonimato ≥ 7 por recorte), as métricas agregadas aparecerão aqui.",
      y,
    );
    return y;
  }

  const classGeral =
    resumo.media_geral != null ? classificarMedia(resumo.media_geral) : null;

  y = kvLinha(doc, "Respondentes (total)", String(resumo.n_total), y);
  y = kvLinha(
    doc,
    "Setores com respostas",
    `${resumo.n_setores} (${resumo.n_setores_alto} em risco alto)`,
    y,
  );
  y = kvLinhaCor(
    doc,
    "Média geral DRPS",
    resumo.media_geral != null
      ? `${fmtMedia(resumo.media_geral)} (escala 1-5)`
      : "Sem amostra válida (n<7 em todos os recortes)",
    y,
    corClassificacao(classGeral),
  );
  y = kvLinhaCor(
    doc,
    "Classificação geral",
    classGeral ? rotuloClassificacao(classGeral) : "Indeterminada",
    y,
    corClassificacao(classGeral),
  );
  y = kvLinha(
    doc,
    "Dimensão mais crítica",
    resumo.dimensao_mais_critica
      ? `${resumo.dimensao_mais_critica.dim_nome} · média ${fmtMedia(
          resumo.dimensao_mais_critica.media,
        )}`
      : "Aguardando amostras",
    y,
  );
  y = kvLinha(
    doc,
    "Contrato mais crítico",
    resumo.contrato_mais_critico
      ? `${resumo.contrato_mais_critico.forma} · média ${fmtMedia(
          resumo.contrato_mais_critico.media,
        )} · n=${resumo.contrato_mais_critico.n}`
      : "Sem amostra suficiente",
    y,
  );

  return y;
}

function secaoPorDimensao(
  doc: PDFKit.PDFDocument,
  dados: DadosRelatorio,
  y: number,
): number {
  y = quebraSeNecessario(doc, y, 600);
  y = secao(doc, "2. Risco por dimensão NR-1", y);

  // Agrega médias por dimensão ponderadas pela amostra de cada setor válido —
  // mesma lógica que resumoExecutivo usa internamente para "dimensão crítica".
  const acc = new Map<string, { nome: string; soma: number; n: number }>();
  for (const s of dados.setores) {
    if (s.amostra_insuficiente || s.media == null) continue;
    for (const d of s.por_dimensao) {
      if (d.media == null) continue;
      const cur = acc.get(d.dim_id) ?? { nome: d.dim_nome, soma: 0, n: 0 };
      cur.soma += d.media * s.n_respostas;
      cur.n += s.n_respostas;
      acc.set(d.dim_id, cur);
    }
  }

  if (acc.size === 0) {
    return paragrafo(
      doc,
      "Sem amostra válida (n ≥ 7) para apresentar médias por dimensão.",
      y,
    );
  }

  const linhas = [...acc.values()]
    .map((a) => ({ nome: a.nome, media: a.n > 0 ? a.soma / a.n : 0 }))
    .sort((a, b) => b.media - a.media);

  const widths = [300, 100, 95];
  drawRow(doc, y, ["Dimensão NR-1", "Média", "Classificação"], widths, true);
  y += 18;
  linha(doc, y);
  y += 4;
  for (const l of linhas) {
    y = quebraSeNecessario(doc, y, 760);
    const c = classificarMedia(l.media);
    drawRow(
      doc,
      y,
      [l.nome, l.media.toFixed(2), rotuloClassificacao(c)],
      widths,
      false,
      corClassificacao(c),
      2,
    );
    y += 16;
  }
  return y;
}

function secaoPorSetor(
  doc: PDFKit.PDFDocument,
  setores: AnalisePorSetor[],
  y: number,
): number {
  y = quebraSeNecessario(doc, y, 600);
  y = secao(doc, "3. Risco por setor", y);

  if (setores.length === 0) {
    return paragrafo(doc, "Nenhum setor com respostas registradas.", y);
  }

  const widths = [220, 70, 90, 115];
  drawRow(
    doc,
    y,
    ["Setor", "Respostas", "Média", "Classificação"],
    widths,
    true,
  );
  y += 18;
  linha(doc, y);
  y += 4;
  for (const s of setores) {
    y = quebraSeNecessario(doc, y, 760);
    if (s.amostra_insuficiente || s.media == null || s.classificacao == null) {
      drawRow(
        doc,
        y,
        [trunc(s.setor, 42), String(s.n_respostas), "—", "amostra insuficiente"],
        widths,
        false,
        COR_MUTED,
        3,
      );
    } else {
      drawRow(
        doc,
        y,
        [
          trunc(s.setor, 42),
          String(s.n_respostas),
          s.media.toFixed(2),
          rotuloClassificacao(s.classificacao),
        ],
        widths,
        false,
        corClassificacao(s.classificacao),
        3,
      );
    }
    y += 16;
  }
  y = espaco(y, 4);
  y = nota(
    doc,
    "Recortes com menos de 7 respostas são omitidos por k-anonimato (LGPD).",
    y,
  );
  return y;
}

function secaoPorContrato(
  doc: PDFKit.PDFDocument,
  contratos: AnalisePorContrato[],
  y: number,
): number {
  y = quebraSeNecessario(doc, y, 600);
  y = secao(doc, "4. Risco por forma de contratação", y);

  if (contratos.length === 0) {
    return paragrafo(
      doc,
      "Nenhuma forma de contratação com respostas registradas.",
      y,
    );
  }

  // Destaque MPT: alguma forma não-CLT com média acima da CLT?
  const validos = contratos.filter(
    (c): c is AnalisePorContrato & { media: number } =>
      !c.amostra_insuficiente && c.media != null,
  );
  const clt = validos.find((c) => /clt/i.test(c.forma_atuacao));
  const naoCltAcima = clt
    ? validos.filter((c) => c !== clt && c.media > clt.media)
    : [];

  const widths = [200, 70, 90, 125];
  drawRow(
    doc,
    y,
    ["Forma de contratação", "Respostas", "Média", "Classificação"],
    widths,
    true,
  );
  y += 18;
  linha(doc, y);
  y += 4;
  for (const c of contratos) {
    y = quebraSeNecessario(doc, y, 760);
    if (c.amostra_insuficiente || c.media == null || c.classificacao == null) {
      drawRow(
        doc,
        y,
        [
          trunc(c.forma_atuacao, 38),
          String(c.n_respostas),
          "—",
          "amostra insuficiente",
        ],
        widths,
        false,
        COR_MUTED,
        3,
      );
    } else {
      drawRow(
        doc,
        y,
        [
          trunc(c.forma_atuacao, 38),
          String(c.n_respostas),
          c.media.toFixed(2),
          rotuloClassificacao(c.classificacao),
        ],
        widths,
        false,
        corClassificacao(c.classificacao),
        3,
      );
    }
    y += 16;
  }

  if (naoCltAcima.length > 0 && clt) {
    y = espaco(y, 6);
    y = destaqueMpt(
      doc,
      `Atenção (fiscalização MPT): ${naoCltAcima
        .map((c) => `${c.forma_atuacao} (${c.media.toFixed(2)})`)
        .join(", ")} apresenta(m) risco psicossocial médio acima do quadro CLT (${clt.media.toFixed(
        2,
      )}). Recorte sensível para auditoria de equiparação de condições de trabalho.`,
      y,
    );
  }

  return y;
}

function secaoOutliers(
  doc: PDFKit.PDFDocument,
  outliers: Outlier[],
  y: number,
): number {
  y = quebraSeNecessario(doc, y, 600);
  y = secao(doc, "5. Outliers setoriais", y);

  if (outliers.length === 0) {
    return paragrafo(
      doc,
      "Nenhum setor com média de risco significativamente acima da média geral (threshold 1,0 ponto ou 0,5·DP).",
      y,
    );
  }

  const widths = [200, 80, 95, 110];
  drawRow(
    doc,
    y,
    ["Setor", "Média", "Desvio (+)", "Classificação"],
    widths,
    true,
  );
  y += 18;
  linha(doc, y);
  y += 4;
  for (const o of outliers) {
    y = quebraSeNecessario(doc, y, 760);
    drawRow(
      doc,
      y,
      [
        trunc(o.setor, 38),
        o.media.toFixed(2),
        `+${o.desvio.toFixed(2)}`,
        rotuloClassificacao(o.classificacao),
      ],
      widths,
      false,
      corClassificacao(o.classificacao),
      3,
    );
    y += 16;
  }
  return y;
}

function secaoEvolucao(
  doc: PDFKit.PDFDocument,
  serie: PontoSerie[],
  y: number,
): number {
  y = quebraSeNecessario(doc, y, 580);
  y = secao(doc, "6. Evolução por dimensão (ciclos)", y);

  if (serie.length === 0) {
    return paragrafo(
      doc,
      "Sem histórico de ciclos para comparar. A evolução aparece a partir da segunda campanha DRPS aplicada.",
      y,
    );
  }

  // Conjunto ordenado de dimensões observadas em qualquer ciclo.
  const dimNomes = new Map<string, string>();
  for (const p of serie) {
    for (const d of p.mediaPorDim) dimNomes.set(d.dim_id, d.dim_nome);
  }
  const dims = [...dimNomes.entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );

  // Cabeçalho: Dimensão + uma coluna por ciclo (limita para caber na página).
  const MAX_CICLOS = 6;
  const pontos =
    serie.length > MAX_CICLOS ? serie.slice(serie.length - MAX_CICLOS) : serie;

  const colDim = 150;
  const colCiclo = Math.floor((495 - colDim) / pontos.length);
  const widths = [colDim, ...pontos.map(() => colCiclo)];
  const headerCols = ["Dimensão", ...pontos.map((p) => trunc(p.ciclo_label, 10))];
  drawRow(doc, y, headerCols, widths, true);
  y += 18;
  linha(doc, y);
  y += 4;

  for (const [dimId, dimNome] of dims) {
    y = quebraSeNecessario(doc, y, 760);
    const cols = [trunc(dimNome, 24)];
    for (const p of pontos) {
      const d = p.mediaPorDim.find((x) => x.dim_id === dimId);
      cols.push(d ? d.media.toFixed(2) : "—");
    }
    drawRow(doc, y, cols, widths, false, COR_INK, -2);
    y += 16;
  }

  // Linha de média geral por ciclo.
  y = quebraSeNecessario(doc, y, 760);
  linha(doc, y);
  y += 4;
  const cols = ["Média geral"];
  for (const p of pontos) cols.push(p.media_geral.toFixed(2));
  drawRow(doc, y, cols, widths, true);
  y += 16;

  if (serie.length > MAX_CICLOS) {
    y = espaco(y, 4);
    y = nota(
      doc,
      `Exibindo os ${MAX_CICLOS} ciclos mais recentes (de ${serie.length} no histórico).`,
      y,
    );
  }
  return y;
}

/* -------------------------------------------------------------------------- */
/*  Cabeçalho / rodapé                                                          */
/* -------------------------------------------------------------------------- */

function cabecalho(doc: PDFKit.PDFDocument, empresaNome: string, geradoEm: Date) {
  doc
    .fillColor(COR_INK)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text("PrevIA", 50, 50, { continued: true })
    .fillColor(COR_IA)
    .text("  Relatório DRPS");

  doc
    .fillColor(COR_MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "Diagnóstico de Riscos Psicossociais · NR-1 · Portaria MTE 1.419/2024",
      50,
      75,
    );

  doc
    .fillColor(COR_INK)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(trunc(empresaNome, 40), 300, 50, { width: 245, align: "right" });
  doc
    .fillColor(COR_MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(fmtData(geradoEm), 300, 66, { width: 245, align: "right" });

  doc
    .moveTo(50, 100)
    .lineTo(545, 100)
    .strokeColor(COR_IA)
    .lineWidth(2)
    .stroke();
}

function rodape(doc: PDFKit.PDFDocument, geradoEm: Date) {
  const ry = 760;
  doc
    .fillColor(COR_MUTED)
    .font("Helvetica")
    .fontSize(7.5)
    .text(
      `Privacidade por desenho: respostas anônimas por construção · agregados só com k-anonimato (k ≥ 7) · LGPD. Sem dados individuais. Relatório gerado em ${fmtData(
        geradoEm,
      )}. PrevIA · O Ecossistema Omni-SST · uma solução P2A Tech`,
      50,
      ry,
      { width: 495, align: "center" },
    );
}

/* -------------------------------------------------------------------------- */
/*  Primitivas de desenho (mesmo padrão de pgr-pdf.ts)                          */
/* -------------------------------------------------------------------------- */

function secao(doc: PDFKit.PDFDocument, titulo: string, y: number): number {
  doc.fillColor(COR_INK).font("Helvetica-Bold").fontSize(13).text(titulo, 50, y);
  doc
    .moveTo(50, y + 19)
    .lineTo(545, y + 19)
    .strokeColor(COR_IA)
    .lineWidth(0.8)
    .stroke();
  return y + 28;
}

function kvLinha(doc: PDFKit.PDFDocument, k: string, v: string, y: number): number {
  doc.fillColor(COR_MUTED).font("Helvetica").fontSize(9).text(k, 50, y, { width: 175 });
  doc.fillColor(COR_INK).font("Helvetica").fontSize(10).text(v, 230, y, { width: 315 });
  return Math.max(doc.y, y) + 4;
}

function kvLinhaCor(
  doc: PDFKit.PDFDocument,
  k: string,
  v: string,
  y: number,
  cor: string,
): number {
  doc.fillColor(COR_MUTED).font("Helvetica").fontSize(9).text(k, 50, y, { width: 175 });
  doc.fillColor(cor).font("Helvetica-Bold").fontSize(10).text(v, 230, y, { width: 315 });
  return Math.max(doc.y, y) + 4;
}

function paragrafo(doc: PDFKit.PDFDocument, texto: string, y: number): number {
  doc
    .fillColor(COR_INK)
    .font("Helvetica")
    .fontSize(10)
    .text(texto, 50, y, { width: 495, align: "justify" });
  return doc.y + 4;
}

function nota(doc: PDFKit.PDFDocument, texto: string, y: number): number {
  doc
    .fillColor(COR_MUTED)
    .font("Helvetica-Oblique")
    .fontSize(8)
    .text(texto, 50, y, { width: 495 });
  return doc.y + 4;
}

function destaqueMpt(doc: PDFKit.PDFDocument, texto: string, y: number): number {
  const h = doc.heightOfString(texto, { width: 475 }) + 20;
  doc.roundedRect(50, y, 495, h, 6).strokeColor(COR_HUMANO).lineWidth(1).stroke();
  doc
    .fillColor(COR_HUMANO)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(texto, 60, y + 10, { width: 475 });
  return y + h + 4;
}

function linha(doc: PDFKit.PDFDocument, y: number) {
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
}

function espaco(y: number, dy: number): number {
  return y + dy;
}

function quebraSeNecessario(
  doc: PDFKit.PDFDocument,
  y: number,
  limite: number,
): number {
  if (y > limite) {
    doc.addPage();
    return 60;
  }
  return espaco(y, 16);
}

/**
 * Desenha uma linha de tabela. `colorIdx` indica qual coluna recebe `niveCor`
 * (-1 = nenhuma; -2 = todas as colunas exceto a 0 ficam em COR_INK puro).
 * A coluna 0 sempre sai em COR_IA (rótulo), exceto em cabeçalho (COR_MUTED).
 */
function drawRow(
  doc: PDFKit.PDFDocument,
  y: number,
  cols: string[],
  widths: number[],
  header = false,
  niveCor?: string,
  colorIdx = -1,
) {
  let x = 50;
  doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(9);
  cols.forEach((c, i) => {
    if (header) doc.fillColor(COR_MUTED);
    else if (colorIdx === -2) doc.fillColor(i === 0 ? COR_IA : COR_INK);
    else if (i === colorIdx && niveCor) doc.fillColor(niveCor);
    else if (i === 0) doc.fillColor(COR_IA);
    else doc.fillColor(COR_INK);
    doc.text(c, x, y, { width: widths[i] - 4, ellipsis: true });
    x += widths[i];
  });
}
