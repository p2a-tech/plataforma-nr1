/**
 * Governança & LGPD — configuração REAL persistida (antes eram toggles só no cliente).
 *
 *   GET   → lista os controles (críticos primeiro). Sem banco ou tabela vazia →
 *           fallback para o mock `togglesGovernanca` com `fonte:'mock'`; senão `fonte:'real'`.
 *   PATCH → { id, ativo }. Liga/desliga um controle. Restrito a papéis sst|admin
 *           (getSessao → 403 caso contrário). Registra atualizado_em/atualizado_por.
 *           Desligar um item `critico` é permitido, mas fica auditável.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";
import { getSessao } from "@/lib/auth";
import { togglesGovernanca } from "@/lib/mock-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS_EDITORES = ["sst", "admin"] as const;

export interface ConfigGovernanca {
  id: string;
  titulo: string;
  descricao: string;
  ativo: boolean;
  critico: boolean;
  atualizado_em?: string | null;
  atualizado_por?: string | null;
}

/** Mock ordenado (críticos primeiro) — formato idêntico ao das linhas reais. */
function mockOrdenado(): ConfigGovernanca[] {
  return [...togglesGovernanca]
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      ativo: t.ativo,
      critico: Boolean(t.critico),
      atualizado_em: null,
      atualizado_por: null,
    }))
    .sort((a, b) => Number(b.critico) - Number(a.critico));
}

export async function GET() {
  if (!dbHabilitado) {
    return NextResponse.json({ fonte: "mock", itens: mockOrdenado() });
  }
  try {
    const itens = await sql<ConfigGovernanca[]>`
      select id, titulo, descricao, ativo, critico, atualizado_em, atualizado_por
      from public.config_governanca
      order by critico desc, titulo asc
    `;
    if (itens.length === 0) {
      return NextResponse.json({ fonte: "mock", itens: mockOrdenado() });
    }
    return NextResponse.json({ fonte: "real", itens });
  } catch (e) {
    console.error("[governanca] erro ao ler config", e);
    return NextResponse.json({ fonte: "mock", itens: mockOrdenado() });
  }
}

const Body = z.object({
  id: z.string().trim().min(1).max(60),
  ativo: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const sessao = getSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }
  if (!PAPEIS_EDITORES.includes(sessao.papel as (typeof PAPEIS_EDITORES)[number])) {
    return NextResponse.json(
      { erro: "Apenas Gestor SST ou Admin podem alterar controles de governança" },
      { status: 403 },
    );
  }
  if (!dbHabilitado) {
    return NextResponse.json({ erro: "Banco indisponível" }, { status: 503 });
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
      { erro: "Dados inválidos", detalhe: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }
  const { id, ativo } = parsed.data;

  try {
    const [row] = await sql<ConfigGovernanca[]>`
      update public.config_governanca
         set ativo = ${ativo},
             atualizado_em = now(),
             atualizado_por = ${sessao.email}
       where id = ${id}
      returning id, titulo, descricao, ativo, critico, atualizado_em, atualizado_por
    `;
    if (!row) {
      return NextResponse.json({ erro: "Controle não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    console.error("[governanca] erro ao atualizar", e);
    return NextResponse.json({ erro: "Falha ao salvar alteração" }, { status: 500 });
  }
}
