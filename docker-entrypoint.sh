#!/bin/sh
# ============================================================================
#  PrevIA · entrypoint da imagem de produção
# ----------------------------------------------------------------------------
#  Roda as migrations (idempotentes) ANTES de subir o servidor Next.
#  - Usa DATABASE_URL (role superuser) — a mesma que cria as roles previa_app.
#  - migrate.mjs é no-op quando o banco já está atualizado.
#  - set -e: se a migration falhar, o container NÃO sobe (fail-closed: nunca
#    serve a app contra um schema inconsistente).
# ============================================================================
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] aplicando migrations (scripts/migrate.mjs)..."
  node scripts/migrate.mjs
else
  echo "[entrypoint] DATABASE_URL ausente — pulando migrations."
fi

echo "[entrypoint] iniciando servidor Next (server.js)..."
exec node server.js
