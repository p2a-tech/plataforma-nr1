/**
 * POST /api/drps/importar
 *
 * Importa respostas DRPS a partir de um CSV exportado do Google Forms.
 * Gated `sst|admin` (gate via cookie de sessão, mesma lógica das páginas).
 *
 * Body (application/json):
 *   {
 *     csv_texto: string,                   // CSV cru (máx ~10MB)
 *     mapeamento: Record<string,string|null>, // header→codigoPergunta|null
 *     instrumento_id: string (uuid),
 *     campanha_id?: string|null,           // opcional, usado por Dev B
 *     dry_run?: boolean                    // se true, NÃO grava
 *   }
 *
 * Response 200:
 *   {
 *     ok: true,
 *     resumo: { total_lidas, sucesso, erros: [{linha, motivos}], dry_run }
 *   }
 *
 * Por que não multipart: a UI lê o CSV no client (FileReader) e POSTa como
 * JSON — mais simples de validar, não precisa parser multipart no edge runtime,
 * e o limit de 10MB já cobre planilhas grandes do Forms (cada resposta ~2KB).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dbHabilitado } from "@/lib/db";
import { getSessao } from "@/lib/auth";
import { carregarInstrumentoComPerguntas } from "@/lib/drps";
import { importar } from "@/lib/drps-importador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    csv_texto: z.string().min(1).max(10 * 1024 * 1024), // 10MB
    mapeamento: z.record(z.string(), z.string().nullable()),
    instrumento_id: z.string().uuid(),
    campanha_id: z.string().uuid().nullish(),
    dry_run: z.boolean().optional().default(false),
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }

  // Gate: só sst|admin podem importar
  const sessao = getSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  }
  if (sessao.papel !== "sst" && sessao.papel !== "admin") {
    return NextResponse.json({ erro: "papel_nao_autorizado" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "schema_invalido", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { csv_texto, mapeamento, instrumento_id, campanha_id, dry_run } =
    parsed.data;

  // Validação cross-tenant do instrumento (espelha /api/drps/responder):
  // o instrumento precisa ser global (empresa_id IS NULL) OU pertencer à empresa
  // da sessão. Sem isso, qualquer sst|admin poderia importar contra um
  // instrumento de OUTRA empresa. Vale também no dry-run.
  const instrumentoCarregado =
    await carregarInstrumentoComPerguntas(instrumento_id);
  if (!instrumentoCarregado) {
    return NextResponse.json(
      { erro: "instrumento_nao_encontrado" },
      { status: 404 },
    );
  }
  if (
    instrumentoCarregado.instrumento.empresa_id &&
    instrumentoCarregado.instrumento.empresa_id !== sessao.empresa_id
  ) {
    return NextResponse.json(
      { erro: "instrumento_de_outra_empresa" },
      { status: 403 },
    );
  }

  try {
    const resumo = await importar(sessao.empresa_id, csv_texto, {
      mapeamento,
      instrumento_id,
      campanha_id,
      dryRun: dry_run,
    });

    // Trunca erros a 20 entradas (UI exibe os primeiros — quem precisar de
    // detalhe completo roda dry-run múltiplas vezes ou inspeciona logs)
    const errosTruncados = resumo.erros.slice(0, 20);
    return NextResponse.json(
      {
        ok: true,
        resumo: {
          total_lidas: resumo.total_lidas,
          sucesso: resumo.sucesso,
          erros: errosTruncados,
          erros_totais: resumo.erros.length,
          dry_run: resumo.dry_run,
        },
      },
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { erro: "falha_importacao", detalhe: msg },
      { status: 500 },
    );
  }
}
