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

const store = new AsyncLocalStorage<{ empresaId: string }>();

export async function withEmpresa<T>(empresaId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ empresaId }, () => comEscopoEmpresa(empresaId, fn));
}

export function empresaAtual(): string {
  const ctx = store.getStore();
  if (!ctx) {
    throw new Error(
      "[tenant] consulta sem escopo de empresa — chame withEmpresa(empresaId, ...) na página",
    );
  }
  return ctx.empresaId;
}

/** Variante segura para wrappers que toleram "nenhum escopo" (testes etc.). */
export function empresaAtualOuNull(): string | null {
  return store.getStore()?.empresaId ?? null;
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
