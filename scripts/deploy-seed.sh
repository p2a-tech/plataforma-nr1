#!/usr/bin/env bash
# ============================================================================
#  GPSPrevIA · provisiona o banco (schema + seed + migrations + dados Grupo GPS)
# ----------------------------------------------------------------------------
#  Aplica TUDO contra a DATABASE_URL informada (ex.: o Postgres do Easypanel),
#  de uma vez. Idempotente: pode rodar de novo sem duplicar.
#
#  Uso (a partir da raiz do repo):
#    DATABASE_URL='postgres://user:pwd@host:5432/db' bash scripts/deploy-seed.sh
#    # opcional: gera micro-pulsos recentes do piloto (Translog) via API:
#    DATABASE_URL='...' bash scripts/deploy-seed.sh https://seu-dominio
#
#  Requisitos: psql e node (com as deps do repo; instala 'postgres' se faltar).
#  Override do psql:  PSQL='C:/Program Files/PostgreSQL/18/bin/psql.exe' ...
# ============================================================================
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
APP_URL="${1:-}"
PSQL="${PSQL:-psql}"
export PGCLIENTENCODING=UTF8

if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: defina DATABASE_URL (ex.: DATABASE_URL='postgres://...' bash scripts/deploy-seed.sh)" >&2
  exit 1
fi

cd "$(dirname "$0")/.."   # raiz do repo

psql_f() { "$PSQL" "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }

echo "» 1/4  schema + seed (db/init/*.sql)"
for f in db/init/*.sql; do
  echo "   - $f"
  psql_f "$f"
done

echo "» 2/4  migrations (db/migrations via scripts/migrate.mjs)"
if [ ! -d node_modules/postgres ]; then
  echo "   instalando dependência 'postgres' para o migrate…"
  npm install --no-save postgres@3 >/dev/null 2>&1 || npm install --no-save postgres@3
fi
DATABASE_URL="$DATABASE_URL" node scripts/migrate.mjs

echo "» 3/4  dados do Grupo GPS (17 empresas, 180k colaboradores, ~147k respostas, segmentos)"
psql_f db/seed-grupo-gps.sql
psql_f db/seed-diretoria-user.sql

if [ -n "$APP_URL" ]; then
  echo "» 4/4  micro-pulsos recentes do piloto (Translog) via $APP_URL"
  node scripts/simular-pulsos.mjs 60 --url "$APP_URL" || echo "   (aviso: simular-pulsos falhou — etapa opcional)"
else
  echo "» 4/4  (pulado) passe a URL do app como argumento para gerar micro-pulsos do piloto"
fi

echo
echo "✓ Banco provisionado. Login (senha previa123):"
echo "    diretoria@gps.com.br · gestor@translog.com.br · clinica@translog.com.br · admin@p2a.tech"
