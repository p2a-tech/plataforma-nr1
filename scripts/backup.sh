#!/usr/bin/env bash
# ============================================================================
#  PrevIA · backup do Postgres de produção (pg_dump via docker exec)
# ----------------------------------------------------------------------------
#  Faz um dump comprimido com timestamp e aplica retenção simples.
#
#  Uso (na VPS, a partir da raiz do projeto):
#    ./scripts/backup.sh
#
#  Variáveis (com defaults sensatos):
#    BACKUP_DIR      diretório de saída              (default: ./backups)
#    DB_CONTAINER    nome do container do Postgres   (default: previa-db)
#    POSTGRES_USER   usuário do banco                (default: previa)
#    POSTGRES_DB     nome do banco                   (default: previa)
#    RETENTION_DAYS  apaga dumps mais antigos que N  (default: 14)
#
#  Agende via cron (ex.: diário às 03:00):
#    0 3 * * * cd /opt/previa && ./scripts/backup.sh >> /var/log/previa-backup.log 2>&1
# ============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="${DB_CONTAINER:-previa-db}"
POSTGRES_USER="${POSTGRES_USER:-previa}"
POSTGRES_DB="${POSTGRES_DB:-previa}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTFILE="${BACKUP_DIR}/previa_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Dump de '${POSTGRES_DB}' (container ${DB_CONTAINER}) -> ${OUTFILE}"

# pg_dump roda DENTRO do container (o banco não expõe porta no host).
# -Fp (plain) + gzip = arquivo restaurável com `gunzip -c | psql`.
docker exec -t "${DB_CONTAINER}" \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists \
  | gzip -9 > "${OUTFILE}"

# Sanidade: dump não pode ser vazio.
if [ ! -s "${OUTFILE}" ]; then
  echo "[backup] ERRO: dump vazio — removendo ${OUTFILE}" >&2
  rm -f "${OUTFILE}"
  exit 1
fi

SIZE="$(du -h "${OUTFILE}" | cut -f1)"
echo "[backup] OK (${SIZE})."

# Retenção: remove dumps mais antigos que RETENTION_DAYS.
echo "[backup] Retenção: removendo dumps com mais de ${RETENTION_DAYS} dias."
find "${BACKUP_DIR}" -name 'previa_*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete || true

echo "[backup] Concluído."

# ----------------------------------------------------------------------------
# Restauração (manual):
#   gunzip -c backups/previa_previa_YYYYMMDD_HHMMSS.sql.gz \
#     | docker exec -i previa-db psql -U previa -d previa
#
# Dica: copie os dumps para storage off-site (S3/Backblaze/rsync) — manter
# backups só na própria VPS não protege contra perda do servidor.
# ----------------------------------------------------------------------------
