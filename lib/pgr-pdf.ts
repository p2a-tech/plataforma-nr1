import "server-only";
import PDFDocument from "pdfkit";
import { OFENSORES_LABEL } from "@previa/contracts";
import { empresa, type Risco } from "@/lib/mock-data";
import type { PgrAssinatura, PgrResumo } from "@/lib/queries";
import type { PgrRevisao, RiscoManualPgr } from "@/lib/pgr";

/**
 * Gera o PDF do PGR — documento oficial verificável no FORMATO OKÊBAMBO.
 *
 * Onda 4 / Backlog §6 — 9 seções obrigatórias:
 *   1. Identificação da empresa
 *   2. Objetivo do PGR
 *   3. Caracterização das atividades
 *   4. Identificação dos riscos ocupacionais (4.1 físicos, 4.2 ergonômicos, 4.3 psicossociais)
 *   5. Avaliação dos riscos (matriz 3×3)
 *   6. Plano de ação (agrupado por dimensão)
 *   7. Monitoramento dos riscos
 *   8. Registro e documentação (hash SHA-256 + selo HMAC — mantido)
 *   9. Responsável pela elaboração (assinatura digital — mantido)
 *
 * Os campos novos (responsável técnico, CNPJ formatado, atividades, riscos
 * manuais físicos/ergonômicos) entram na canonicalização do hash via lib/queries
 * — qualquer mudança neles muda o hash → exige nova assinatura. Isso preserva
 * tamper-evidência ponta-a-ponta.
 *
 * Compatibilidade: se `dados` (PgrRevisao) é undefined ou campos NULL, o PDF
 * mostra "(não informado)" no lugar — não quebra.
 */

const COR_INK = "#0B1F3A"; // navy
const COR_MUTED = "#5B6B82";
const COR_IA = "#00C2D1";
const COR_HUMANO = "#FF6B35";
const COR_OK = "#27AE60";
const COR_ALERTA = "#E5484D";
const COR_AMBAR = "#FFB020";

const NAO_INFORMADO = "(não informado)";

function nivel(severidade: number, probabilidade: number): { label: string; cor: string } {
  const score = severidade * probabilidade;
  if (score >= 15) return { label: "Crítico", cor: COR_ALERTA };
  if (score >= 9) return { label: "Alto", cor: COR_HUMANO };
  if (score >= 4) return { label: "Médio", cor: COR_AMBAR };
  return { label: "Baixo", cor: COR_IA };
}

/**
 * Aproxima probabilidade/impacto em rótulos de matriz 3x3 (compatível com a
 * matriz Okêbambo usada no backlog §4). Severidade 1-5 e Probabilidade 1-5 →
 * rótulos `Baixo/Médio/Alto`.
 */
function rotuloProb(p: number): "Baixa" | "Média" | "Alta" {
  if (p <= 2) return "Baixa";
  if (p <= 3) return "Média";
  return "Alta";
}
function rotuloImp(s: number): "Baixo" | "Médio" | "Alto" {
  if (s <= 2) return "Baixo";
  if (s <= 3) return "Médio";
  return "Alto";
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

function valor(v: string | null | undefined): string {
  return v && v.trim() !== "" ? v : NAO_INFORMADO;
}

export interface PgrPdfInput {
  empresaNome?: string;
  empresaCnpj?: string;
  assinatura: PgrAssinatura;
  resumo: PgrResumo;
  riscos: Risco[];
  /** Dados Okêbambo da revisão (Seções 1, 3, 4.1, 4.2, 9). */
  dados?: PgrRevisao | null;
}

/**
 * Gera o PDF e retorna como Buffer (pronto para `new Response(buffer)`).
 * Estrutura: 9 seções Okêbambo + cabeçalho/rodapé institucionais.
 */
export async function gerarPgrPdf(input: PgrPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      info: {
        Title: `PGR · revisão ${input.assinatura.revisao}`,
        Author: "PrevIA · P2A Tech",
        Subject: "Programa de Gerenciamento de Riscos Psicossociais (NR-1)",
        Keywords: "NR-1, PGR, riscos psicossociais, Okêbambo",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const dados = input.dados ?? null;

    /* ───────────────────── Cabeçalho ─────────────────────── */
    cabecalho(doc, input.assinatura.revisao, input.assinatura.assinado_em);

    /* ───────────────────── Seção 1 — Identificação ─────────── */
    let y = 130;
    y = secao(doc, "1. Identificação da empresa", y);
    y = kvLinha(doc, "Razão social", valor(dados?.razao_social ?? input.empresaNome ?? empresa.nome), y);
    y = kvLinha(doc, "Nome fantasia", valor(dados?.nome_fantasia ?? input.empresaNome ?? empresa.nome), y);
    y = kvLinha(doc, "CNPJ", valor(dados?.cnpj ?? input.empresaCnpj ?? empresa.cnpj), y);
    y = kvLinha(doc, "Endereço", valor(dados?.endereco), y);
    y = kvLinha(
      doc,
      "Responsável técnico",
      `${valor(dados?.responsavel_tecnico_nome)}${
        dados?.responsavel_tecnico_conselho || dados?.responsavel_tecnico_registro
          ? `  ·  ${valor(dados?.responsavel_tecnico_conselho)} ${valor(dados?.responsavel_tecnico_registro)}`
          : ""
      }`,
      y,
    );
    y = kvLinha(doc, "Nº profissionais (estimativa)", `${input.resumo.totalEventos > 0 ? "—" : "—"} (atendimentos: ${input.resumo.totalEventos})`, y);

    /* ───────────────────── Seção 2 — Objetivo ──────────────── */
    y = espaco(y, 16);
    y = secao(doc, "2. Objetivo do PGR", y);
    y = paragrafo(
      doc,
      "Promover a saúde, a segurança e o bem-estar dos profissionais da clínica por meio da identificação, avaliação, controle e monitoramento contínuo dos riscos ocupacionais — em particular, dos riscos psicossociais previstos na NR-1 (Portaria MTE 1.419/2024). Este programa orienta as ações preventivas e interventivas, assegurando ambiente de trabalho saudável, respeitoso e em conformidade com a legislação aplicável.",
      y,
    );

    /* ───────────────────── Seção 3 — Atividades ────────────── */
    y = espaco(y, 16);
    y = secao(doc, "3. Caracterização das atividades", y);
    y = kvLinha(doc, "Público atendido", valor(dados?.publico_atendido), y);
    y = paragrafo(doc, valor(dados?.descricao_atividades), y);

    /* ───────────────────── Seção 4 — Riscos ocupacionais ───── */
    if (y > 640) {
      doc.addPage();
      y = 60;
    } else {
      y = espaco(y, 16);
    }
    y = secao(doc, "4. Identificação dos riscos ocupacionais", y);

    // 4.1 Físicos
    y = subSecao(doc, "4.1 Riscos físicos", y);
    y = tabelaRiscosManual(doc, dados?.riscos_fisicos ?? [], y, "físico");

    // 4.2 Ergonômicos
    y = espaco(y, 10);
    y = subSecao(doc, "4.2 Riscos ergonômicos", y);
    y = tabelaRiscosManual(doc, dados?.riscos_ergonomicos ?? [], y, "ergonômico");

    // 4.3 Psicossociais (a partir do inventário automatizado)
    y = espaco(y, 10);
    y = subSecao(doc, "4.3 Riscos psicossociais", y);
    if (input.riscos.length === 0) {
      y = paragrafo(doc, "Nenhum risco psicossocial mapeado nesta revisão.", y);
    } else {
      y = tabelaRiscosPsicossociais(doc, input.riscos, y);
    }

    /* ───────────────────── Seção 5 — Avaliação dos riscos ──── */
    if (y > 600) {
      doc.addPage();
      y = 60;
    } else {
      y = espaco(y, 16);
    }
    y = secao(doc, "5. Avaliação dos riscos (matriz 3×3)", y);
    y = paragrafo(
      doc,
      "Aplicada a matriz de risco 3×3 (Probabilidade × Impacto) conforme guia NR-1. Cada fator psicossocial recebe classificação automática a partir dos atendimentos clínicos e respostas do radar.",
      y,
    );
    y = tabelaMatriz(doc, input.riscos, y);

    /* ───────────────────── Seção 6 — Plano de ação ─────────── */
    if (y > 640) {
      doc.addPage();
      y = 60;
    } else {
      y = espaco(y, 16);
    }
    y = secao(doc, "6. Plano de ação", y);
    if (input.riscos.length === 0) {
      y = paragrafo(doc, "Nenhum plano de ação ativo nesta revisão.", y);
    } else {
      for (const r of input.riscos) {
        if (y > 740) {
          doc.addPage();
          y = 60;
        }
        const niv = nivel(r.severidade, r.probabilidade);
        doc.fillColor(COR_IA).font("Helvetica-Bold").fontSize(9).text(`${r.id}  `, 50, y, { continued: true });
        doc
          .fillColor(COR_INK)
          .font("Helvetica")
          .text(`${r.fonte} (${r.setor})  ·  `, { continued: true })
          .fillColor(niv.cor)
          .text(niv.label, { continued: true })
          .fillColor(COR_MUTED)
          .text(`  ·  Responsável: ${r.responsavel}  ·  Prazo: ${r.prazo}`);
        doc.moveDown(0.2);
        doc.fillColor(COR_MUTED).fontSize(9).text(r.acao, 60, doc.y, { width: 485 });
        y = doc.y + 6;
      }
    }

    /* ───────────────────── Seção 7 — Monitoramento ─────────── */
    if (y > 640) {
      doc.addPage();
      y = 60;
    } else {
      y = espaco(y, 16);
    }
    y = secao(doc, "7. Monitoramento dos riscos", y);
    y = paragrafo(
      doc,
      "Periodicidade: revisão obrigatória anual e em mudanças organizacionais relevantes. Gatilhos de revisão antecipada: contratação ou desligamento de mais de 10% do quadro, novas demandas operacionais, percepção dos profissionais (via radar ou DRPS), e ocorrência de protocolo de risco grave (E8). O monitoramento é contínuo via PrevIA: novos atendimentos atualizam o snapshot automaticamente; mudanças no snapshot invalidam a assinatura vigente.",
      y,
    );

    /* ───────────────────── Seção 8 — Registro/documentação ─── */
    if (y > 580) {
      doc.addPage();
      y = 60;
    } else {
      y = espaco(y, 16);
    }
    y = secao(doc, "8. Registro e documentação", y);
    y = paragrafo(
      doc,
      "Diagnóstico, matriz, plano e monitoramento ficam consolidados no snapshot canônico do PGR. A integridade é verificada por SHA-256 (hash do conteúdo) e por HMAC (selo da assinatura), apresentados a seguir.",
      y,
    );

    // Bloco hash + selo (tamper-evidência visível)
    y = espaco(y, 6);
    doc
      .roundedRect(50, y, 495, 90, 6)
      .strokeColor(COR_IA)
      .lineWidth(1)
      .stroke();
    doc
      .fillColor(COR_IA)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Impressão digital criptográfica", 60, y + 10);
    doc
      .fillColor(COR_MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Esta revisão cobre exatamente o conteúdo cujo hash está abaixo. Qualquer mudança nos riscos, na conformidade ou nos dados Okêbambo (identificação, atividades, riscos manuais) altera o hash — e exige nova assinatura. O selo HMAC garante que esta assinatura foi de fato registrada por PrevIA.",
        60,
        y + 25,
        { width: 475 },
      );
    doc
      .fillColor(COR_INK)
      .font("Courier-Bold")
      .fontSize(7)
      .text(`Hash (SHA-256): ${input.assinatura.conteudo_hash}`, 60, y + 60)
      .text(`Selo  (HMAC):   ${input.assinatura.selo}`, 60, y + 72);
    y += 96;

    /* ───────────────────── Seção 9 — Responsável ───────────── */
    if (y > 620) {
      doc.addPage();
      y = 60;
    } else {
      y = espaco(y, 16);
    }
    y = secao(doc, "9. Responsável pela elaboração", y);
    y = kvLinha(doc, "Nome", input.assinatura.assinante_nome, y);
    y = kvLinha(doc, "Função", input.assinatura.assinante_papel, y);
    y = kvLinha(
      doc,
      "Registro profissional",
      input.assinatura.assinante_registro && input.assinatura.assinante_registro.trim() !== ""
        ? input.assinatura.assinante_registro
        : `${valor(dados?.responsavel_tecnico_conselho)} ${valor(dados?.responsavel_tecnico_registro)}`,
      y,
    );
    y = kvLinha(doc, "Data da assinatura", fmtData(input.assinatura.assinado_em), y);
    y = kvLinha(doc, "Revisão", String(input.assinatura.revisao), y);

    /* ───────────────────── Rodapé/Governança ─────────────── */
    rodape(doc);

    doc.end();
  });
}

/* -------------------------------------------------------------------------- */
/*  Helpers de seção / desenho                                                 */
/* -------------------------------------------------------------------------- */
function cabecalho(doc: PDFKit.PDFDocument, revisao: number, assinadoEm: string) {
  doc
    .fillColor(COR_INK)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text("PrevIA", 50, 50, { continued: true })
    .fillColor(COR_IA)
    .text("  PGR formato Okêbambo");

  doc
    .fillColor(COR_MUTED)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "Programa de Gerenciamento de Riscos Psicossociais · NR-1 · Portaria MTE 1.419/2024",
      50,
      75,
    );

  doc
    .fontSize(9)
    .fillColor(COR_MUTED)
    .text(`Revisão ${revisao}`, 450, 50, { align: "right" })
    .text(fmtData(assinadoEm), 450, 65, { align: "right" });

  doc
    .moveTo(50, 100)
    .lineTo(545, 100)
    .strokeColor(COR_IA)
    .lineWidth(2)
    .stroke();
}

function rodape(doc: PDFKit.PDFDocument) {
  const ry = 760;
  doc
    .fillColor(COR_MUTED)
    .font("Helvetica")
    .fontSize(7.5)
    .text(
      "Privacidade por desenho: anonimato real (k-anonymity, k ≥ 7) · LGPD · A IA é copiloto; a responsabilidade técnica é humana e está registrada nesta assinatura. PrevIA · O Ecossistema Omni-SST · uma solução P2A Tech",
      50,
      ry,
      { width: 495, align: "center" },
    );
}

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

function subSecao(doc: PDFKit.PDFDocument, titulo: string, y: number): number {
  doc.fillColor(COR_INK).font("Helvetica-Bold").fontSize(11).text(titulo, 50, y);
  return y + 18;
}

function kvLinha(doc: PDFKit.PDFDocument, k: string, v: string, y: number): number {
  doc.fillColor(COR_MUTED).font("Helvetica").fontSize(9).text(k, 50, y, { width: 145 });
  doc.fillColor(COR_INK).font("Helvetica").fontSize(10).text(v, 200, y, { width: 345 });
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

function espaco(y: number, dy: number): number {
  return y + dy;
}

function tabelaRiscosManual(
  doc: PDFKit.PDFDocument,
  riscos: RiscoManualPgr[],
  y: number,
  categoria: "físico" | "ergonômico" = "físico",
): number {
  if (!riscos || riscos.length === 0) {
    doc
      .fillColor(COR_MUTED)
      .font("Helvetica-Oblique")
      .fontSize(9)
      .text(`(nenhum risco ${categoria} informado)`, 50, y);
    return y + 14;
  }
  // Cabeçalho
  drawRow(doc, y, ["Risco", "Fonte", "Consequência"], [165, 165, 165], true);
  y += 18;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
  y += 4;
  for (const r of riscos) {
    if (y > 740) {
      doc.addPage();
      y = 60;
    }
    drawRow(doc, y, [r.risco ?? "—", r.fonte ?? "—", r.consequencia ?? "—"], [165, 165, 165], false);
    y += 16;
  }
  return y;
}

function tabelaRiscosPsicossociais(
  doc: PDFKit.PDFDocument,
  riscos: Risco[],
  y: number,
): number {
  drawRow(
    doc,
    y,
    ["ID", "Fonte (organização)", "Setor", "Sev × Prob", "Nível", "Responsável"],
    [40, 170, 110, 60, 50, 90],
    true,
  );
  y += 18;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
  y += 4;
  for (const r of riscos) {
    if (y > 740) {
      doc.addPage();
      y = 60;
    }
    const niv = nivel(r.severidade, r.probabilidade);
    drawRow(
      doc,
      y,
      [
        r.id,
        r.fonte.length > 32 ? r.fonte.slice(0, 30) + "…" : r.fonte,
        r.setor.length > 18 ? r.setor.slice(0, 17) + "…" : r.setor,
        `${r.severidade} × ${r.probabilidade}`,
        niv.label,
        r.responsavel.length > 18 ? r.responsavel.slice(0, 17) + "…" : r.responsavel,
      ],
      [40, 170, 110, 60, 50, 90],
      false,
      niv.cor,
    );
    y += 16;
  }
  return y;
}

function tabelaMatriz(doc: PDFKit.PDFDocument, riscos: Risco[], y: number): number {
  drawRow(
    doc,
    y,
    ["Fator", "Setor", "Probabilidade", "Impacto", "Classificação"],
    [180, 110, 80, 70, 75],
    true,
  );
  y += 18;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
  y += 4;
  for (const r of riscos) {
    if (y > 740) {
      doc.addPage();
      y = 60;
    }
    const niv = nivel(r.severidade, r.probabilidade);
    drawRow(
      doc,
      y,
      [
        r.fonte.length > 36 ? r.fonte.slice(0, 34) + "…" : r.fonte,
        r.setor.length > 22 ? r.setor.slice(0, 20) + "…" : r.setor,
        rotuloProb(r.probabilidade),
        rotuloImp(r.severidade),
        niv.label,
      ],
      [180, 110, 80, 70, 75],
      false,
      niv.cor,
      4,
    );
    y += 16;
  }
  return y;
}

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
  // Por padrão, a coluna que destacamos é a 4 (índice 4) na tabela de inventário.
  // No fluxo da matriz (5 colunas), passamos `colorIdx=4` explicitamente.
  const idxDestaque = colorIdx >= 0 ? colorIdx : 4;
  cols.forEach((c, i) => {
    if (header) doc.fillColor(COR_MUTED);
    else if (i === idxDestaque && niveCor) doc.fillColor(niveCor);
    else if (i === 0) doc.fillColor(COR_IA);
    else doc.fillColor(COR_INK);
    doc.text(c, x, y, { width: widths[i] - 4, ellipsis: true });
    x += widths[i];
  });
}
