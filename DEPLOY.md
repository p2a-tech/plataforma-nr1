# PrevIA · Deploy (VPS self-hosted)

Runbook para subir a plataforma numa VPS Linux com Docker. A stack de produção
roda via `docker-compose.prod.yml`: **Postgres** (rede interna, sem porta no
host) + **app** (Next.js standalone) + **Caddy** (reverse proxy com HTTPS
automático).

> **Importante:** o `docker-compose.yml` (na raiz) + os scripts em `db/init/`
> são **só para desenvolvimento local** (sobem o Postgres com schema e seed/demo
> e expõem a porta 5432). Em produção use **sempre** `docker-compose.prod.yml` e
> o versionador de migrations (`scripts/migrate.mjs`) — veja
> `db/migrations/README.md`.

---

## 1. Provisionar a VPS

- Linux x86_64 (Ubuntu 22.04+/Debian 12+), 1–2 vCPU, 2 GB+ RAM, 20 GB+ disco.
- Instale Docker Engine + plugin Compose:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- Abra apenas as portas **80** e **443** no firewall (a 22/SSH conforme sua
  política). **Não** abra a 5432 — o banco fica só na rede interna do Docker.
- Clone o repositório (ex.: em `/opt/previa`):
  ```bash
  git clone <repo> /opt/previa && cd /opt/previa
  ```

## 2. DNS

Crie um registro **A** (e **AAAA** se tiver IPv6) do seu domínio
(ex.: `previa.suaempresa.com.br`) apontando para o IP público da VPS.
Faça isso **antes** de subir o Caddy — ele só emite o certificado TLS quando o
domínio já resolve para o servidor.

## 3. Variáveis de ambiente

```bash
cp .env.production.example .env.production
# edite e troque TODOS os segredos:
#   POSTGRES_PASSWORD, DATABASE_URL (mesma senha), AUTH_SECRET, PGR_SECRET,
#   CLINIC_SECRETS_JSON, DOMAIN  (+ ANTHROPIC_* / WHATSAPP_* se for usar)
nano .env.production
```

Gere segredos fortes com `openssl rand -hex 32`.
**Nunca** faça commit do `.env.production`.

## 4. Subir a stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Isso faz o build da imagem do app, sobe o Postgres (com healthcheck) e o Caddy.

## 5. Aplicar as migrations

O Postgres de produção começa **vazio** (os scripts `db/init/` NÃO rodam aqui).
Aplique o schema versionado:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

Rode este comando a cada deploy que inclua novas migrations — é idempotente.

## 6. TLS (Caddy)

O Caddy emite e renova o certificado **automaticamente** (Let's Encrypt) para o
`DOMAIN`, desde que o DNS aponte para a VPS e as portas 80/443 estejam livres.
Os certificados ficam no volume `previa_caddy_data` (persistido).

Verifique:
```bash
docker compose -f docker-compose.prod.yml logs -f caddy
curl -I https://SEU_DOMINIO/
```

## 7. Verificação

```bash
docker compose -f docker-compose.prod.yml ps          # todos "healthy"/"running"
curl -fsS https://SEU_DOMINIO/api/health               # healthcheck do app
docker compose -f docker-compose.prod.yml logs -f app  # logs da aplicação
```

## 8. Backups (cron)

`scripts/backup.sh` faz `pg_dump` comprimido com timestamp e retenção.

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh        # testa um backup manual (gera ./backups/*.sql.gz)
```

Agende diariamente (crontab da VPS):
```
0 3 * * * cd /opt/previa && ./scripts/backup.sh >> /var/log/previa-backup.log 2>&1
```

Copie os dumps para storage **off-site** (S3/Backblaze/rsync) — backup só na
própria VPS não protege contra perda do servidor. Restauração:
```bash
gunzip -c backups/previa_previa_YYYYMMDD_HHMMSS.sql.gz \
  | docker exec -i previa-db psql -U previa -d previa
```

## 9. Atualizar (novo deploy)

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build app
docker compose -f docker-compose.prod.yml run --rm migrate   # se houver migrations novas
```

## Troubleshooting

- **App em 503 / DB indisponível:** confira `DATABASE_URL` (host `db`, senha
  igual a `POSTGRES_PASSWORD`) e `docker compose ... logs db`.
- **TLS não emite:** DNS ainda não propagou ou portas 80/443 bloqueadas/ocupadas.
- **Healthcheck falhando:** veja `docker inspect previa-app` e
  `docker compose ... logs app`; o endpoint é `/api/health`.
