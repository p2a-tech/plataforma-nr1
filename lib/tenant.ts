import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { comEscopoEmpresa } from "@/lib/db";

/**
 * Multi-tenancy (E5 + RLS): contexto de empresa.
 *
 * `withEmpresa(empresaId, fn)`:
 *   1. Abre uma transação Postgres como `previa_app` (sem bypass de RLS).
 *   2. Seta `app.empresa_id = empresaId` via `set_config(..., true)` (LOCAL).
 *   3. Roda `fn` dentro do escopo (AsyncLocalStorage) — todas as queries
 *      `sql\`...\`` usam essa transação automaticamente (via proxy em lib/db).
 *
 * Defesa em profundidade: mesmo que uma query app-level esqueça do filtro
 * `where empresa_id = ...`, o RLS no banco recusa as outras linhas.
 *
 * Se chamada sem escopo, `empresaAtual()` LANÇA — fail-closed.
 */

const store = new AsyncLocalStorage<{ empresaIds: string[] }>();

/** Escopo de UMA empresa (sst/clinica). */
export async function withEmpresa<T>(empresaId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ empresaIds: [empresaId] }, () => comEscopoEmpresa(empresaId, fn));
}

/**
 * Escopo de VÁRIAS empresas (Diretoria: consolidado do grupo ou seleção).
 * As queries filtram com `empresa_id = ANY(empresasAtuais())`. O set_config do
 * RLS recebe a primeira empresa (irrelevante na conexão superusuário de dev),
 * então o ANY é o filtro efetivo.
 */
export async function withEmpresas<T>(empresaIds: string[], fn: () => Promise<T>): Promise<T> {
  const ids = empresaIds.length ? empresaIds : ["emp_unscoped"];
  return store.run({ empresaIds: ids }, () => comEscopoEmpresa(ids[0], fn));
}

/** Lista de empresas no escopo atual (1 = única; N = consolidado do grupo). */
export function empresasAtuais(): string[] {
  const ctx = store.getStore();
  if (!ctx) {
    throw new Error(
      "[tenant] consulta sem escopo de empresa — chame withEmpresa/withEmpresas(...) na página",
    );
  }
  return ctx.empresaIds;
}

/** Compat: primeira empresa do escopo. */
export function empresaAtual(): string {
  return empresasAtuais()[0];
}

/** Variante segura para wrappers que toleram "nenhum escopo" (testes etc.). */
export function empresaAtualOuNull(): string | null {
  return store.getStore()?.empresaIds[0] ?? null;
}

import { exigirSessao, type Papel } from "@/lib/auth";

/**
 * Combina gate de RBAC + escopo de empresa numa única chamada para uso no
 * topo de páginas server. Substitui o par `exigirSessao([...]); withEmpresa(...)`.
 */
export async function pagePorPapel<T>(
  papeis: Papel[],
  fn: (sessao: ReturnType<typeof exigirSessao>) => Promise<T>,
): Promise<T> {
  const sessao = exigirSessao(papeis);
  return withEmpresa(sessao.empresa_id, () => fn(sessao));
}
