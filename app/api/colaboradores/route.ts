/**
 * GET  /api/colaboradores            → lista colaboradores (CPF MASCARADO)
 * POST /api/colaboradores            → importa lote (CSV cru ou linhas[]) (upsert)
 *
 * Gated sst|admin. Quadro de RH do empregador, separado das respostas anônimas
 * do DRPS — usado só para o fan-out do eSocial S-2240 por CPF.
 *
 * Import (POST) aceita:
 *   { csv_texto: string }   — CSV com cabeçalho (cpf,nome,matricula,setor,cargo,ativo)
 *   OU
 *   { linhas: Array<{cpf,nome?,matricula?,setor,cargo?,ativo?}> }
 * Limite de 5MB no corpo do CSV.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dbHabilitado } from "@/lib/db";
import { getSessao } from "@/lib/auth";
import {
  listarColaboradores,
  importarColaboradores,
  contarPorSetor,
} from "@/lib/colaboradores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = new Set(["sst", "admin"]);
const MAX_CSV = 5 * 1024 * 1024; // 5MB

function negar(): NextResponse | null {
  const sessao = getSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!PAPEIS.has(sessao.papel)) {
    return NextResponse.json({ erro: "papel_nao_autorizado" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }
  const bloqueio = negar();
  if (bloqueio) return bloqueio;
  const sessao = getSessao()!;

  try {
    const [colaboradores, porSetor] = await Promise.all([
      listarColaboradores(sessao.empresa_id),
      contarPorSetor(sessao.empresa_id),
    ]);
    return NextResponse.json({ ok: true, colaboradores, porSetor });
  } catch (e) {
    console.error("[/api/colaboradores] GET erro:", e);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}

/* -------------------------------------------------------------------------- */
/*  CSV mínimo (parser tolerante a aspas) → linhas{}                          */
/* -------------------------------------------------------------------------- */

const COLUNAS: Record<string, string> = {
  cpf: "cpf",
  nome: "nome",
  matricula: "matricula",
  matrícula: "matricula",
  setor: "setor",
  cargo: "cargo",
  funcao: "cargo",
  função: "cargo",
  ativo: "ativo",
};

function parseCsv(texto: string): Array<Record<string, string>> {
  const limpo = texto.replace(/^﻿/, "");
  const out: string[][] = [];
  let campo = "";
  let cur: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++; }
        else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { aspas = true; continue; }
    if (c === "," || c === ";") { cur.push(campo); campo = ""; continue; }
    if (c === "\r") { if (limpo[i + 1] === "\n") i++; cur.push(campo); out.push(cur); campo = ""; cur = []; continue; }
    if (c === "\n") { cur.push(campo); out.push(cur); campo = ""; cur = []; continue; }
    campo += c;
  }
  if (campo.length || cur.length) { cur.push(campo); out.push(cur); }
  if (out.length < 1) return [];

  const headers = out[0].map((h) => COLUNAS[h.trim().toLowerCase()] ?? h.trim().toLowerCase());
  const linhas: Array<Record<string, string>> = [];
  for (let r = 1; r < out.length; r++) {
    const cells = out[r];
    if (cells.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = (cells[c] ?? "").trim();
    linhas.push(obj);
  }
  return linhas;
}

function coerceLinha(o: Record<string, string>): Record<string, unknown> {
  const ativoRaw = (o.ativo ?? "").toLowerCase();
  const ativo =
    ativoRaw === "" ? undefined : !["false", "0", "nao", "não", "inativo", "n"].includes(ativoRaw);
  return {
    cpf: o.cpf ?? "",
    nome: o.nome || undefined,
    matricula: o.matricula || undefined,
    setor: o.setor ?? "",
    cargo: o.cargo || undefined,
    ...(ativo === undefined ? {} : { ativo }),
  };
}

const Body = z.union([
  z.object({ csv_texto: z.string().min(1).max(MAX_CSV) }).strict(),
  z.object({ linhas: z.array(z.record(z.string(), z.unknown())).max(20000) }).strict(),
]);

export async function POST(req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
  }
  const bloqueio = negar();
  if (bloqueio) return bloqueio;
  const sessao = getSessao()!;

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

  let linhas: unknown[];
  if ("csv_texto" in parsed.data) {
    linhas = parseCsv(parsed.data.csv_texto).map(coerceLinha);
  } else {
    linhas = parsed.data.linhas;
  }

  try {
    const resultado = await importarColaboradores(sessao.empresa_id, linhas);
    return NextResponse.json({
      ok: true,
      resumo: {
        inseridos: resultado.inseridos,
        atualizados: resultado.atualizados,
        erros: resultado.erros.slice(0, 30),
        erros_totais: resultado.erros.length,
        total_lidas: linhas.length,
      },
    });
  } catch (e) {
    console.error("[/api/colaboradores] POST erro:", e);
    return NextResponse.json({ erro: "falha_importacao" }, { status: 500 });
  }
}
