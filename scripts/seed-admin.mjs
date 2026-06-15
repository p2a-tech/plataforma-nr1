#!/usr/bin/env node
// ============================================================================
//  PrevIA · bootstrap do primeiro admin (idempotente)
// ----------------------------------------------------------------------------
//  Cria empresa + usuário admin SE ainda não existir, lendo as credenciais
//  de env (nunca commitadas):
//    ADMIN_BOOTSTRAP_EMAIL     (obrigatório p/ rodar)
//    ADMIN_BOOTSTRAP_PASSWORD  (obrigatório p/ rodar)
//    ADMIN_BOOTSTRAP_NOME          (opcional, default "Admin")
//    ADMIN_BOOTSTRAP_EMPRESA_ID    (opcional, default "emp_p2a")
//    ADMIN_BOOTSTRAP_EMPRESA_NOME  (opcional, default "P2A Tech")
//
//  - Sem as duas primeiras envs → no-op (sai 0).
//  - Se o e-mail já existe → no-op (sai 0).
//  - Senha é hasheada com pgcrypto crypt(..., gen_salt('bf',10)) — compatível
//    com bcryptjs.compare usado no login (formato $2a$).
//  - Roda no entrypoint, DEPOIS das migrations, com DATABASE_URL (superuser).
//  - Falhas são logadas mas NÃO derrubam o boot (o entrypoint trata).
// ============================================================================

import postgres from "postgres";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const senha = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const nome = process.env.ADMIN_BOOTSTRAP_NOME?.trim() || "Admin";
const empresaId = process.env.ADMIN_BOOTSTRAP_EMPRESA_ID?.trim() || "emp_p2a";
const empresaNome = process.env.ADMIN_BOOTSTRAP_EMPRESA_NOME?.trim() || "P2A Tech";

if (!email || !senha) {
  console.log("[seed-admin] ADMIN_BOOTSTRAP_EMAIL/PASSWORD ausentes — nada a fazer.");
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.log("[seed-admin] DATABASE_URL ausente — pulando.");
  process.exit(0);
}

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
  onnotice: () => {},
});

async function main() {
  const [existente] = await sql`select 1 from public.usuarios where lower(email) = ${email} limit 1`;
  if (existente) {
    console.log(`[seed-admin] usuário ${email} já existe — nada a fazer.`);
    return;
  }

  await sql.begin(async (tx) => {
    await tx`
      insert into public.empresas (id, nome, segmento, ativa)
      values (${empresaId}, ${empresaNome}, 'Tecnologia / SaaS NR-1', true)
      on conflict (id) do nothing
    `;
    await tx`
      insert into public.usuarios (email, senha_hash, clinica_id, nome, papel, empresa_id)
      values (${email}, crypt(${senha}, gen_salt('bf', 10)), null, ${nome}, 'admin', ${empresaId})
      on conflict (email) do nothing
    `;
  });

  console.log(`[seed-admin] admin ${email} criado na empresa ${empresaId} (${empresaNome}).`);
}

main()
  .then(() => sql.end({ timeout: 5 }))
  .catch(async (err) => {
    console.error("[seed-admin] ERRO (não-fatal):", err.message ?? err);
    await sql.end({ timeout: 5 }).catch(() => {});
    // Sai 0 mesmo em erro: não deve impedir o app de subir.
    process.exit(0);
  });
