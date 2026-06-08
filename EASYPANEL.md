# Deploy no Easypanel — branch `grupo-gps`

O Easypanel gerencia proxy reverso + HTTPS automaticamente, então **não** usamos
o `Caddyfile` nem os `docker-compose*.yml` daqui (esses são do modelo VPS). No
Easypanel subimos **2 serviços**: um **Postgres** e o **App** (build pelo
`Dockerfile` deste repo, que já gera o Next.js standalone na porta `3000`).

O app só precisa, no mínimo, de `DATABASE_URL` e `AUTH_SECRET`.

---

## 1. Conectar o GitHub (repo privado → precisa de token)

O `p2a-tech/plataforma-nr1` é **privado**, então o Easypanel precisa de um
**GitHub Token** (senão dá `Cannot find public repository ... token is missing`).

1. Crie um **Personal Access Token** no GitHub com leitura do repo:
   - *Classic:* GitHub → Settings → Developer settings → **Tokens (classic)** →
     Generate → escopo **`repo`**.
   - *ou Fine-grained:* owner `p2a-tech`, repo `plataforma-nr1`, permissões
     **Contents: Read** + **Metadata: Read** (pode exigir aprovação do admin da org).
2. No Easypanel: **Settings → GitHub** → cole o token e salve.
3. Na **Fonte → Github** do App preencha:
   - **Proprietário:** `p2a-tech`
   - **Repositório:** `plataforma-nr1`  ⟵ **sem `.git`**
   - **Ramo:** `grupo-gps`
   - **Caminho de Build:** `/`

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

**Opção A — recomendada: o script único `scripts/deploy-seed.sh`.**

Aplica schema + seed + migrations + dados do Grupo GPS (17 empresas, 180k
colaboradores, ~147k respostas) de uma vez. Exponha o `db` temporariamente
(serviço `db` → **Expose** uma porta) ou use um túnel, clone o repo, e rode:

```bash
# Linux / macOS / Git Bash
DATABASE_URL='postgres://USER:PWD@HOST:PORT/DB' bash scripts/deploy-seed.sh
# opcional: gerar micro-pulsos recentes do piloto (Translog) via API:
DATABASE_URL='...' bash scripts/deploy-seed.sh https://SEU_DOMINIO
```

```powershell
# Windows (PowerShell)
$env:DATABASE_URL='postgres://USER:PWD@HOST:PORT/DB'
powershell -ExecutionPolicy Bypass -File scripts\deploy-seed.ps1   # -AppUrl https://SEU_DOMINIO (opcional)
```

> Requer `psql` e `node` na máquina. Roda contra um banco **vazio** (caso do
> Easypanel). Depois, **remova a exposição** da porta do `db`.

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
