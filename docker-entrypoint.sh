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
  # Bootstrap do 1º admin (idempotente; no-op se já existe ou sem env). Não
  # derruba o boot em caso de erro (o próprio script trata e sai 0).
  echo "[entrypoint] verificando bootstrap de admin..."
  node scripts/seed-admin.mjs || echo "[entrypoint] seed-admin pulado/falhou (não-fatal)."
else
  echo "[entrypoint] DATABASE_URL ausente — pulando migrations."
fi

echo "[entrypoint] iniciando servidor Next (server.js)..."
exec node server.js
