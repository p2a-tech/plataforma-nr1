# Deploy no Easypanel — branch `grupo-gps`

O Easypanel gerencia proxy reverso + HTTPS automaticamente, então **não** usamos
o `Caddyfile` nem os `docker-compose*.yml` daqui (esses são do modelo VPS). No
Easypanel subimos **2 serviços**: um **Postgres** e o **App** (build pelo
`Dockerfile` deste repo, que já gera o Next.js standalone na porta `3000`).

O app só precisa, no mínimo, de `DATABASE_URL` e `AUTH_SECRET`.

---

## 1. Conectar o GitHub

Em **Settings → GitHub**, instale o GitHub App do Easypanel e dê acesso ao
repositório `p2a-tech/plataforma-nr1` (privado).

## 2. Criar o projeto e o Postgres

1. Crie um projeto (ex.: `previa`).
2. **+ Service → Postgres**
   - Service name: `db`
   - Image: `postgres:16`
   - Defina uma **senha forte**.
3. Após criar, abra o serviço `db` → aba **Credentials** e copie a
   **Connection URL interna** (algo como
   `postgres://postgres:SENHA@previa_db:5432/previa`). Você vai usá-la no app.

## 3. Criar o App

**+ Service → App**

- **Service name:** `app`
- **Source → GitHub:** `p2a-tech/plataforma-nr1`, **Branch:** `grupo-gps`
- **Build → Dockerfile** (arquivo: `Dockerfile`) — o repo já está com
  `output: standalone` e `EXPOSE 3000`.
- **Deploy:** porta do container **3000**.

### Variáveis de ambiente (aba Environment)

Cole (ajuste a `DATABASE_URL` para a do passo 2 e gere segredos com
`openssl rand -hex 32`):

```env
DATABASE_URL=postgres://postgres:SENHA_DO_DB@previa_db:5432/previa
PGSSL=disable
AUTH_SECRET=GERE_openssl_rand_hex_32
PGR_SECRET=GERE_openssl_rand_hex_32
CLINIC_SECRETS_JSON={"clin_translog_demo":"GERE_um_segredo"}
NODE_ENV=production
# Opcionais (IA / WhatsApp) — deixe em branco para desabilitar:
# ANTHROPIC_API_KEY=
# WHATSAPP_TOKEN=
```

> `DATABASE_URL_APP` / `DATABASE_URL_ADMIN` não são necessárias — o app cai na
> `DATABASE_URL` (o usuário `postgres` do Easypanel é superusuário; o `PGSSL=disable`
> vale porque o tráfego fica na rede interna do projeto).

## 4. Domínio

No App → **Domains**: adicione seu domínio (ou use o subdomínio do Easypanel),
**porta 3000**, e habilite **HTTPS** (Let's Encrypt automático).

## 5. Deploy

Clique em **Deploy**. O Easypanel faz `docker build` do `Dockerfile` na branch
`grupo-gps` e sobe o container. O healthcheck bate em `/api/health`.

Ative **Auto Deploy** (no Source) para reconstruir a cada push na `grupo-gps`.

---

## 6. Schema + dados (faça uma vez)

O Postgres sobe **vazio**. O login real usa os usuários do banco, então é
preciso aplicar o schema/seed/migrations. Como `scripts/` e `db/` ficam fora da
imagem do app (`.dockerignore`), aplique a partir de uma **máquina com o repo
clonado**, apontando para o banco do Easypanel.

**Opção A — recomendada: replicar o ambiente (schema + seed + migrations + dados do Grupo GPS).**

Exponha o `db` temporariamente (serviço `db` → **Expose** uma porta, ex.: 5432)
ou use um túnel. Com `DATABASE_URL` apontando para o banco do Easypanel:

```bash
# 1) schema + seed (cria tabelas e os 3 usuários demo: senha previa123)
for f in db/init/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
# 2) migrations (multitenancy + RLS)
node scripts/migrate.mjs
# 3) Grupo GPS: 17 empresas, 180k colaboradores, ~147k respostas, segmentos
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seed-grupo-gps.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seed-diretoria-user.sql
# 4) micro-pulsos recentes (destrava o "tempo real" do dashboard)
node scripts/simular-pulsos.mjs 60 --url https://SEU_DOMINIO
```

> Depois, **remova a exposição** da porta do `db` (deixe só na rede interna).

**Opção B — clonar o banco local exato (pg_dump → restore):**

```bash
pg_dump --no-owner --no-acl "postgres://previa:SENHA_LOCAL@127.0.0.1:5432/previa" > previa.sql
psql "$DATABASE_URL_EASYPANEL" -f previa.sql
```

## 7. Acessar

Abra `https://SEU_DOMINIO`. Login (senha `previa123`):

| Perfil    | E-mail                      | Vai para     |
| --------- | --------------------------- | ------------ |
| Diretoria | `diretoria@gps.com.br`      | `/dashboard` (com filtro Global/empresa) |
| Gestor SST| `gestor@translog.com.br`    | `/dashboard` |
| Clínica   | `clinica@translog.com.br`   | `/atendimento` |
| Admin P2A | `admin@p2a.tech`            | `/admin` |

---

## Atalho: template

O arquivo [`easypanel.json`](./easypanel.json) é um **template** (Postgres + App)
que pode ser importado em **Create from Template → Schema**. Após importar,
ajuste a `DATABASE_URL` (host = nome interno do serviço Postgres) e os segredos.
