/**
 * /api/drps/campanha — GET (listar) + POST (criar) campanhas da empresa.
 *
 * Onda 5 · Dev B · §8. Substitui o token determinístico HMAC por uma campanha
 * persistente com expiração, ciclo e múltiplas instâncias por empresa.
 *
 * Gates:
 *   - Sessão obrigatória (sst | admin) — leitura/escrita expõe metadados.
 *   - Tenant scope via withEmpresa (RLS); lookups via lib/drps-campanha.ts.
 *
 * Body POST: validado com NovaCampanhaSchema (Zod strict).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSessao } from "@/lib/auth";
import { dbHabilitado } from "@/lib/db";
import {
  listarCampanhas,
  criarCampanha,
  NovaCampanhaSchema,
} from "@/lib/drps-campanha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gate() {
  const s = getSessao();
  if (!s) return { erro: "nao_autenticado" as const, status: 401 };
  if (s.papel !== "sst" && s.papel !== "admin") {
    return { erro: "sem_permissao" as const, status: 403 };
  }
  return { sessao: s };
}

export async function GET(_req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "banco_indisponivel" }, { status: 503 });
  }
  const g = gate();
  if ("erro" in g) return NextResponse.json({ erro: g.erro }, { status: g.status });

  const url = new URL(_req.url);
  const ativosParam = url.searchParams.get("ativos");
  const ativos =
    ativosParam == null ? undefined : ativosParam === "true";

  const campanhas = await listarCampanhas(g.sessao.empresa_id, { ativos });
  return NextResponse.json({ ok: true, campanhas });
}

export async function POST(req: NextRequest) {
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "banco_indisponivel" }, { status: 503 });
  }
  const g = gate();
  if ("erro" in g) return NextResponse.json({ erro: g.erro }, { status: g.status });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "json_invalido" }, { status: 400 });
  }

  const parsed = NovaCampanhaSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        erro: "schema_invalido",
        detalhes: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  try {
    const c = await criarCampanha(g.sessao.empresa_id, parsed.data);
    return NextResponse.json({ ok: true, campanha: c }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Conflito de código único — mais comum aqui.
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json(
        { erro: "codigo_duplicado", detalhe: msg },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { erro: "falha_criar", detalhe: msg },
      { status: 500 },
    );
  }
}
