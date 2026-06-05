#!/usr/bin/env node
// ============================================================================
//  PrevIA · job de retenção de dados (E7.2 / LGPD)
// ----------------------------------------------------------------------------
//  Aplica (ou simula) a política de retenção descrita em docs/LGPD.md:
//    - pulso_respostas  (anônimas) : remove após RETENCAO_MESES.
//    - pulso_sessoes    (efêmeras) : remove sessões paradas após SESSOES_DIAS.
//    - webhook_audit_log (log)     : remove após RETENCAO_MESES.
//
//  Espelha lib/lgpd.ts — a lib é server-only/aliased (@/), então o script usa
//  sua própria conexão `postgres` + DATABASE_URL e roda as MESMAS queries.
//
//  Uso (com DATABASE_URL no ambiente):
//    node scripts/retencao.mjs            # --dry-run (padrão): só CONTA
//    node scripts/retencao.mjs --dry-run  # idem, explícito
//    node scripts/retencao.mjs --apply    # APLICA: apaga de fato
//
//  Cron (diário, 03:00):  0 3 * * *  node /app/scripts/retencao.mjs --apply
// ============================================================================

import postgres from "postgres";

// Mantidos em sincronia com lib/lgpd.ts.
const RETENCAO_MESES = 12;
const SESSOES_DIAS = 30;

const apply = process.argv.includes("--apply");
const dryRun = !apply; // padrão seguro: dry-run a menos que --apply

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[retencao] DATABASE_URL não definida. Abortando.");
  process.exit(1);
}

// SSL: mesma heurística de lib/db.ts / scripts/migrate.mjs.
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

const corteMeses = `${RETENCAO_MESES} months`;
const corteSessoes = `${SESSOES_DIAS} days`;

async function contar() {
  const [r] = await sql`
    select count(*)::int as n from public.pulso_respostas
    where respondido_em < now() - ${corteMeses}::interval
  `;
  const [s] = await sql`
    select count(*)::int as n from public.pulso_sessoes
    where atualizado_em < now() - ${corteSessoes}::interval
  `;
  const [a] = await sql`
    select count(*)::int as n from public.webhook_audit_log
    where recebido_em < now() - ${corteMeses}::interval
  `;
  return {
    pulso_respostas: r.n,
    pulso_sessoes: s.n,
    webhook_audit_log: a.n,
  };
}

async function apagar() {
  const r = await sql`
    delete from public.pulso_respostas
    where respondido_em < now() - ${corteMeses}::interval
  `;
  const s = await sql`
    delete from public.pulso_sessoes
    where atualizado_em < now() - ${corteSessoes}::interval
  `;
  const a = await sql`
    delete from public.webhook_audit_log
    where recebido_em < now() - ${corteMeses}::interval
  `;
  return {
    pulso_respostas: r.count,
    pulso_sessoes: s.count,
    webhook_audit_log: a.count,
  };
}

async function main() {
  const modo = dryRun ? "DRY-RUN (apenas contagem)" : "APPLY (removendo)";
  console.log(`[retencao] ${modo} · retenção=${RETENCAO_MESES}m · sessões=${SESSOES_DIAS}d`);

  const contagens = dryRun ? await contar() : await apagar();
  const verbo = dryRun ? "seriam removidas" : "removidas";

  console.log(`[retencao] pulso_respostas:    ${contagens.pulso_respostas} ${verbo} (> ${RETENCAO_MESES} meses)`);
  console.log(`[retencao] pulso_sessoes:      ${contagens.pulso_sessoes} ${verbo} (> ${SESSOES_DIAS} dias)`);
  console.log(`[retencao] webhook_audit_log:  ${contagens.webhook_audit_log} ${verbo} (> ${RETENCAO_MESES} meses)`);

  const total =
    contagens.pulso_respostas + contagens.pulso_sessoes + contagens.webhook_audit_log;
  console.log(`[retencao] total: ${total} ${verbo}.${dryRun ? " Use --apply para executar." : ""}`);
}

main()
  .then(() => sql.end({ timeout: 5 }))
  .catch(async (err) => {
    console.error("\n[retencao] FALHOU:", err.message ?? err);
    await sql.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  });
