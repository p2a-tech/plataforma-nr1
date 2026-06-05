#!/usr/bin/env node
// ============================================================================
//  PrevIA · versionador de migrations (idempotente)
// ----------------------------------------------------------------------------
//  - Cria a tabela _migrations(name pk, applied_at) se não existir.
//  - Lê db/migrations/*.sql em ordem lexicográfica (0001_, 0002_, ...).
//  - Aplica cada migration ainda não registrada DENTRO de uma transação e
//    grava o nome em _migrations. Rodar de novo é no-op.
//
//  Uso (com DATABASE_URL no ambiente):
//    node scripts/migrate.mjs
//
//  Em produção (compose):
//    docker compose -f docker-compose.prod.yml run --rm migrate
//
//  Cada arquivo .sql deve ser, ele próprio, idempotente quando possível
//  (create table if not exists, insert ... on conflict do nothing).
// ============================================================================

import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, "..", "db", "migrations");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[migrate] DATABASE_URL não definida. Abortando.");
  process.exit(1);
}

// SSL: mesma heurística de lib/db.ts — hosts internos/locais sem TLS.
function resolverSSL(conn) {
  const forc = process.env.PGSSL;
  if (forc === "disable") return false;
  if (forc === "require") return "require";
  if (/sslmode=disable/.test(conn)) return false;
  if (/@(localhost|127\.0\.0\.1|db|previa-db)[:/]/.test(conn)) return false;
  return "require";
}

const sql = postgres(connectionString, {
  ssl: resolverSSL(connectionString),
  max: 1,
  prepare: false,
  onnotice: () => {}, // silencia "NOTICE: relation already exists" etc.
});

async function main() {
  // 1) Tabela de controle.
  await sql`
    create table if not exists public._migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  // 2) Lista arquivos .sql ordenados.
  let files;
  try {
    files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.toLowerCase().endsWith(".sql"))
      .sort();
  } catch (err) {
    console.error(`[migrate] Não consegui ler ${MIGRATIONS_DIR}:`, err.message);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("[migrate] Nenhuma migration encontrada. Nada a fazer.");
    return;
  }

  // 3) Já aplicadas.
  const aplicadas = new Set(
    (await sql`select name from public._migrations`).map((r) => r.name),
  );

  let novas = 0;
  for (const file of files) {
    if (aplicadas.has(file)) {
      console.log(`[migrate] = ${file} (já aplicada)`);
      continue;
    }
    const ddl = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`[migrate] + ${file} ... `);
    // Transação: ou aplica tudo + registra, ou nada.
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx`insert into public._migrations (name) values (${file})`;
    });
    console.log("ok");
    novas += 1;
  }

  console.log(
    novas === 0
      ? "[migrate] Banco já está atualizado."
      : `[migrate] ${novas} migration(s) aplicada(s).`,
  );
}

main()
  .then(() => sql.end({ timeout: 5 }))
  .catch(async (err) => {
    console.error("\n[migrate] FALHOU:", err.message ?? err);
    await sql.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  });
