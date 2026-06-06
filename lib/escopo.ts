import "server-only";
import { cookies } from "next/headers";
import type { Sessao } from "@/lib/auth";
import { withEmpresas } from "@/lib/tenant";
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";

/**
 * Escopo de empresa para a Diretoria (visão consolidada do grupo OU por empresa).
 * Persistido no cookie `previa_empresa_sel` (valor = "global" ou empresa_id).
 * Para sst/clinica, o escopo é sempre a própria empresa da sessão.
 */
export const COOKIE_ESCOPO = "previa_empresa_sel";

// Pseudo-empresas que NÃO entram no consolidado do grupo.
const NAO_GRUPO = ["emp_unscoped", "emp_grupo_gps", "emp_translog"];

export interface Escopo {
  modo: "global" | "empresa";
  ids: string[];
  empresaId: string | null;
  label: string;
}

function ehDiretoria(p: string): boolean {
  return p === "diretoria" || p === "admin";
}

/** IDs das empresas operacionais do grupo (consolidado). */
export async function idsGrupo(): Promise<string[]> {
  if (!dbHabilitado) return [];
  const rows = await sql<{ id: string }[]>`
    select id from public.empresas
    where id <> all(${NAO_GRUPO}) and colaboradores is not null
    order by colaboradores desc
  `;
  return rows.map((r) => r.id);
}

/** Lista (id, nome) das empresas do grupo — para o seletor no header. */
export async function listaGrupo(): Promise<{ id: string; nome: string }[]> {
  if (!dbHabilitado) return [];
  return sql<{ id: string; nome: string }[]>`
    select id, nome from public.empresas
    where id <> all(${NAO_GRUPO}) and colaboradores is not null
    order by nome
  `;
}

/** Resolve o escopo atual a partir da sessão + cookie. */
export async function resolverEscopo(sessao: Sessao): Promise<Escopo> {
  if (!ehDiretoria(sessao.papel)) {
    return { modo: "empresa", ids: [sessao.empresa_id], empresaId: sessao.empresa_id, label: "" };
  }
  const sel = cookies().get(COOKIE_ESCOPO)?.value;
  if (!sel || sel === "global") {
    return { modo: "global", ids: await idsGrupo(), empresaId: null, label: "Grupo GPS · consolidado" };
  }
  const [emp] = await sql<{ nome: string }[]>`select nome from public.empresas where id = ${sel} limit 1`;
  if (!emp) {
    return { modo: "global", ids: await idsGrupo(), empresaId: null, label: "Grupo GPS · consolidado" };
  }
  return { modo: "empresa", ids: [sel], empresaId: sel, label: emp.nome };
}

/** Açúcar: resolve o escopo e roda fn dentro dele (para usar nas páginas). */
export async function withEscopo<T>(sessao: Sessao, fn: () => Promise<T>): Promise<T> {
  const e = await resolverEscopo(sessao);
  return withEmpresas(e.ids, fn);
}
