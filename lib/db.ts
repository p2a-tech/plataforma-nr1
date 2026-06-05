import "server-only";
import postgres from "postgres";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Cliente Postgres (Postgres.js) — multi-tenancy com RLS (E5 + 0006).
 *
 * Duas conexões:
 *   - `sqlAdmin` (DATABASE_URL_ADMIN, role super): bypass de RLS. Para login,
 *     admin console, governança global, e ingestão de webhook (que precisa ler
 *     `clinicas` para descobrir a empresa antes de definir o escopo).
 *   - `sqlAppRoot` (DATABASE_URL_APP, role `previa_app` sem bypass de RLS):
 *     conexão "raiz" usada apenas dentro de transações criadas por
 *     `comEscopoEmpresa()` — fora delas, NÃO devolve nada (RLS).
 *
 * Para a maioria do código (`lib/queries.ts`), exportamos o proxy `sql` que
 * automaticamente usa a TRANSAÇÃO ATIVA da request (via AsyncLocalStorage).
 * As queries existentes (`sql\`...\``) continuam funcionando sem mudança.
 */

const URL_APP =
  process.env.DATABASE_URL_APP || process.env.DATABASE_URL;
const URL_ADMIN =
  process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

if (!URL_APP) {
  console.warn(
    "[previa/db] DATABASE_URL_APP/DATABASE_URL não configurada — rotas que dependem de DB retornam 503.",
  );
}

function resolverSSL(conn: string): "require" | false {
  const forc = process.env.PGSSL;
  if (forc === "disable") return false;
  if (forc === "require") return "require";
  if (/sslmode=disable/.test(conn)) return false;
  if (/@(localhost|127\.0\.0\.1|db|previa-db)[:/]/.test(conn)) return false;
  return "require";
}

declare global {
  // eslint-disable-next-line no-var
  var __previaSqlApp: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __previaSqlAdmin: ReturnType<typeof postgres> | undefined;
}

const sqlAppRoot =
  global.__previaSqlApp ??
  (URL_APP
    ? postgres(URL_APP, {
        ssl: resolverSSL(URL_APP),
        max: 5,
        prepare: false,
      })
    : (postgres("postgres://noop") as unknown as ReturnType<typeof postgres>));

export const sqlAdmin =
  global.__previaSqlAdmin ??
  (URL_ADMIN
    ? postgres(URL_ADMIN, {
        ssl: resolverSSL(URL_ADMIN),
        max: 5,
        prepare: false,
      })
    : (postgres("postgres://noop") as unknown as ReturnType<typeof postgres>));

if (process.env.NODE_ENV !== "production") {
  global.__previaSqlApp = sqlAppRoot;
  global.__previaSqlAdmin = sqlAdmin;
}

export const dbHabilitado = Boolean(URL_APP);

/* -------------------------------------------------------------------------- */
/*  Transação ativa (RLS-aware) — guarda o `tx` da request via ALS            */
/* -------------------------------------------------------------------------- */
const txStore = new AsyncLocalStorage<{
  tx: ReturnType<typeof postgres>;
}>();

/**
 * Abre uma transação na conexão da APP e seta `app.empresa_id = ${empresaId}`
 * via `set_config(..., true)` (LOCAL à transação). Dentro de `fn`, todas as
 * queries `sql\`...\`` (do proxy abaixo) usam essa transação automaticamente,
 * e o Postgres aplica RLS — só linhas dessa empresa são visíveis/escreviveis.
 */
export async function comEscopoEmpresa<T>(
  empresaId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!dbHabilitado) return fn();
  return sqlAppRoot.begin(async (tx) => {
    await tx`select set_config('app.empresa_id', ${empresaId}, true)`;
    return txStore.run({ tx: tx as unknown as ReturnType<typeof postgres> }, fn);
  }) as Promise<T>;
}

function pickClient(): ReturnType<typeof postgres> {
  // Dentro de uma transação escopada → usa o tx.
  // Fora dela → usa sqlAdmin (default seguro para chamadas legadas; código novo
  // deve preferir sqlAdmin explicitamente quando precisa de cross-tenant).
  return txStore.getStore()?.tx ?? sqlAdmin;
}

// Tipo: o proxy se comporta como o cliente postgres.js para o TS.
type SqlClient = ReturnType<typeof postgres>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proxy = new Proxy(function () {} as any, {
  apply(_t, _thisArg, args: unknown[]) {
    return (pickClient() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_t, prop) {
    const client = pickClient() as unknown as Record<string, unknown>;
    const v = client[prop as string];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(client) : v;
  },
}) as SqlClient;
export const sql = proxy;
