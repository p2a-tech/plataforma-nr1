import "server-only";
import PDFDocument from "pdfkit";
import { OFENSORES_LABEL } from "@previa/contracts";
import { empresa, type Risco } from "@/lib/mock-data";
import type { PgrAssinatura, PgrResumo } from "@/lib/queries";

/**
 * Gera o PDF do PGR — documento oficial verificável.
 *
 * Cabeçalho com PrevIA + P2A · resumo do snapshot · matriz de risco resumida
 * em tabela · lista de riscos · **hash do conteúdo + selo HMAC** visíveis para
 * auditoria · assinante e timestamp · rodapé com k-anonymity e LGPD.
 *
 * Para verificar a integridade: recompute `hashConteudo(snapshot)` no banco e
 * compare com o hash impresso aqui. O selo bate via `seloValido()` em lib/pgr.
 */

const COR_INK = "#0B1F3A"; // navy
const COR_MUTED = "#5B6B82";
const COR_IA = "#00C2D1";
const COR_HUMANO = "#FF6B35";
const COR_OK = "#27AE60";
const COR_ALERTA = "#E5484D";

const NIVEL_LABEL: Record<number, string> = {
  1: "Baixo",
  2: "Baixo",
  3: "Médio",
  4: "Médio",
  5: "Alto",
};

function nivel(severidade: number, probabilidade: number): { label: string; cor: string } {
  const score = severidade * probabilidade;
  if (score >= 15) return { label: "Crítico", cor: COR_ALERTA };
  if (score >= 9) return { label: "Alto", cor: COR_HUMANO };
  if (score >= 4) return { label: "Médio", cor: "#FFB020" };
  return { label: "Baixo", cor: COR_IA };
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

export interface PgrPdfInput {
  empresaNome?: string;
  empresaCnpj?: string;
  assinatura: PgrAssinatura;
  resumo: PgrResumo;
  riscos: Risco[];
}

/**
 * Gera o PDF e retorna como Buffer (pronto para `new Response(buffer)`).
 * Use streams para PDFs grandes; aqui o volume é pequeno (poucas páginas).
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
        Keywords: "NR-1, PGR, riscos psicossociais",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    /* ───────────────────── Cabeçalho ─────────────────────── */
    doc
      .fillColor(COR_INK)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("PrevIA", 50, 50, { continued: true })
      .fillColor(COR_IA)
      .text("  PGR vivo");

    doc
      .fillColor(COR_MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text("Programa de Gerenciamento de Riscos Psicossociais · NR-1", 50, 75);

    doc
      .fontSize(9)
      .fillColor(COR_MUTED)
      .text(`Revisão ${input.assinatura.revisao}`, 450, 50, { align: "right" })
      .text(fmtData(input.assinatura.assinado_em), 450, 65, { align: "right" });

    // Linha divisória
    doc
      .moveTo(50, 100)
      .lineTo(545, 100)
      .strokeColor(COR_IA)
      .lineWidth(2)
      .stroke();

    /* ───────────────────── Empresa ───────────────────────── */
    doc
      .fillColor(COR_INK)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(input.empresaNome ?? empresa.nome, 50, 120);

    doc
      .fillColor(COR_MUTED)
      .font("Helvetica")
      .fontSize(10)
      .text(
        `CNPJ: ${input.empresaCnpj ?? empresa.cnpj}    ·    Documento atualizado automaticamente pela IA · validação humana assinada`,
        50,
        140,
      );

    /* ───────────────────── Snapshot ──────────────────────── */
    sectionHeader(doc, "Snapshot do documento", 175);

    const sx = 50;
    const sy = 200;
    const colW = 124;
    const rh = 56;
    metric(doc, sx + colW * 0, sy, "Conformidade NR-1", `${input.resumo.conformidade}%`, COR_IA);
    metric(doc, sx + colW * 1, sy, "Riscos mapeados", String(input.resumo.totalRiscos), COR_INK);
    metric(doc, sx + colW * 2, sy, "Atendimentos", String(input.resumo.totalEventos), COR_INK);
    metric(
      doc,
      sx + colW * 3,
      sy,
      "Críticos + Altos",
      String(input.resumo.criticos + input.resumo.altos),
      COR_ALERTA,
    );

    // Distribuição de severidade
    doc
      .fillColor(COR_MUTED)
      .fontSize(9)
      .text(
        `Distribuição: ${input.resumo.criticos} críticos · ${input.resumo.altos} altos · ${input.resumo.medios} médios · ${input.resumo.baixos} baixos`,
        50,
        sy + rh + 14,
      );

    /* ───────────────────── Inventário de Riscos ──────────── */
    let y = sy + rh + 50;
    sectionHeader(doc, "Inventário de riscos psicossociais", y);
    y += 28;

    // Cabeçalho da tabela
    drawRow(doc, y, ["ID", "Fonte (organização)", "Setor", "Sev × Prob", "Nível", "Responsável"], [
      40, 170, 110, 60, 50, 90,
    ], true);
    y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
    y += 4;

    for (const r of input.riscos) {
      if (y > 720) {
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

    /* ───────────────────── Ações por risco ───────────────── */
    if (y > 600) {
      doc.addPage();
      y = 60;
    } else {
      y += 20;
    }
    sectionHeader(doc, "Plano de ação (aguardando validação humana)", y);
    y += 22;
    doc.fillColor(COR_INK).font("Helvetica").fontSize(9);
    for (const r of input.riscos) {
      if (y > 740) {
        doc.addPage();
        y = 60;
      }
      doc.fillColor(COR_IA).font("Helvetica-Bold").text(`${r.id}  `, 50, y, { continued: true });
      doc
        .fillColor(COR_INK)
        .font("Helvetica")
        .text(`${r.fonte} (${r.setor}): `, { continued: true })
        .fillColor(COR_MUTED)
        .text(r.acao);
      y = doc.y + 4;
    }

    /* ───────────────────── Assinatura + Selo ─────────────── */
    doc.addPage();
    sectionHeader(doc, "Validação humana · assinatura", 60);

    let ay = 95;
    kv(doc, "Assinado por", input.assinatura.assinante_nome, 50, ay);
    ay += 22;
    kv(doc, "Função", input.assinatura.assinante_papel, 50, ay);
    ay += 22;
    if (input.assinatura.assinante_registro) {
      kv(doc, "Registro", input.assinatura.assinante_registro, 50, ay);
      ay += 22;
    }
    kv(doc, "Data e hora", fmtData(input.assinatura.assinado_em), 50, ay);
    ay += 22;
    kv(doc, "Revisão", String(input.assinatura.revisao), 50, ay);
    ay += 36;

    // Bloco de hash + selo (tamper-evidência visível)
    doc
      .roundedRect(50, ay, 495, 90, 6)
      .strokeColor(COR_IA)
      .lineWidth(1)
      .stroke();
    doc
      .fillColor(COR_IA)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Impressão digital criptográfica", 60, ay + 10);
    doc
      .fillColor(COR_MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Esta revisão cobre exatamente o conteúdo cujo hash está abaixo. Qualquer mudança nos riscos ou conformidade altera o hash — e exige nova assinatura. O selo HMAC garante que esta assinatura foi de fato registrada por PrevIA.",
        60,
        ay + 25,
        { width: 475 },
      );

    doc
      .fillColor(COR_INK)
      .font("Courier-Bold")
      .fontSize(7)
      .text(`Hash (SHA-256): ${input.assinatura.conteudo_hash}`, 60, ay + 60)
      .text(`Selo  (HMAC):   ${input.assinatura.selo}`, 60, ay + 72);

    /* ───────────────────── Rodapé/Governança ─────────────── */
    const ry = 720;
    doc
      .fillColor(COR_MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Privacidade por desenho: anonimato real (k-anonymity, k ≥ 7) · LGPD · A IA é copiloto; a responsabilidade técnica é humana e está registrada nesta assinatura.",
        50,
        ry,
        { width: 495, align: "center" },
      )
      .text("PrevIA · O Ecossistema Omni-SST · uma solução P2A Tech", 50, ry + 24, {
        width: 495,
        align: "center",
      });

    doc.end();
  });
}

/* -------------------------------------------------------------------------- */
/*  Helpers de desenho                                                         */
/* -------------------------------------------------------------------------- */
function sectionHeader(doc: PDFKit.PDFDocument, label: string, y: number) {
  doc
    .fillColor(COR_INK)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(label, 50, y);
  doc
    .moveTo(50, y + 18)
    .lineTo(545, y + 18)
    .strokeColor("#EEEEEE")
    .lineWidth(0.5)
    .stroke();
}

function metric(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  valor: string,
  cor: string,
) {
  doc
    .roundedRect(x, y, 110, 50, 4)
    .fillAndStroke("#F7F8FA", "#EEEEEE");
  doc.fillColor(COR_MUTED).font("Helvetica").fontSize(8).text(label, x + 10, y + 8);
  doc.fillColor(cor).font("Helvetica-Bold").fontSize(20).text(valor, x + 10, y + 20);
}

function drawRow(
  doc: PDFKit.PDFDocument,
  y: number,
  cols: string[],
  widths: number[],
  header = false,
  niveCor?: string,
) {
  let x = 50;
  doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(9);
  cols.forEach((c, i) => {
    if (header) doc.fillColor(COR_MUTED);
    else if (i === 4 && niveCor) doc.fillColor(niveCor);
    else if (i === 0) doc.fillColor(COR_IA);
    else doc.fillColor(COR_INK);
    doc.text(c, x, y, { width: widths[i] - 4, ellipsis: true });
    x += widths[i];
  });
}

function kv(doc: PDFKit.PDFDocument, k: string, v: string, x: number, y: number) {
  doc.fillColor(COR_MUTED).font("Helvetica").fontSize(9).text(k, x, y);
  doc.fillColor(COR_INK).font("Helvetica-Bold").fontSize(11).text(v, x + 100, y - 2);
}
