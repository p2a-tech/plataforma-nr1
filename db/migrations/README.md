# Migrations (produção) vs `db/init` (local)

Há **dois** mecanismos de schema neste repo, com papéis diferentes:

| Caminho           | Quando roda                                   | Para quê                          |
| ----------------- | --------------------------------------------- | --------------------------------- |
| `db/init/*.sql`   | **Só na primeira subida** do Postgres, quando o volume está **vazio** (entrypoint oficial do Postgres) | **Dev local** — schema + seed/demo de uma vez |
| `db/migrations/*.sql` | **Sempre que você roda** `scripts/migrate.mjs` | **Produção** — schema versionado e incremental |

## Por que migrations em produção?

Os scripts em `db/init/` **não rodam de novo** depois que o volume já tem dados.
Em produção o banco persiste entre deploys, então mudanças de schema posteriores
nunca seriam aplicadas por ali. As migrations resolvem isso: cada arquivo é
aplicado **uma única vez** e registrado numa tabela de controle.

## Como funciona o `scripts/migrate.mjs`

1. Cria (se faltar) a tabela `public._migrations(name text pk, applied_at timestamptz)`.
2. Lê `db/migrations/*.sql` em ordem **lexicográfica** (`0001_`, `0002_`, ...).
3. Para cada arquivo ainda **não** registrado, aplica o SQL dentro de uma
   **transação** e grava o nome em `_migrations`.
4. Idempotente: rodar de novo não reaplica nada.

### Rodando

```bash
# Local (com DATABASE_URL apontando para o seu Postgres):
DATABASE_URL=postgres://previa:previa_dev_pwd@localhost:5432/previa node scripts/migrate.mjs

# Produção (via compose, ver DEPLOY.md):
docker compose -f docker-compose.prod.yml run --rm migrate
```

## Baseline (`0001_baseline.sql`)

É a consolidação **idempotente** do schema atual (tabelas `clinicas`,
`eventos_agregados`, `ofensores_evento`, `webhook_audit_log`, `usuarios`,
`pgr_assinaturas`, `pulso_alvos`, `pulso_respostas`, `pulso_sessoes`).
**Não** inclui seed/demo — produção recebe dados reais via app/webhooks.

> Aplicar a baseline sobre um banco que **já** tem essas tabelas (ex.: criado
> via `db/init`) é seguro: tudo é `create ... if not exists`. O `_migrations`
> apenas registra que `0001_baseline.sql` foi "aplicada".

## Adicionando uma nova migration

1. Crie `db/migrations/0002_descricao_curta.sql` (numere em sequência).
2. Escreva DDL **idempotente** sempre que possível
   (`create table if not exists`, `alter table ... add column if not exists`,
   `create index if not exists`, `insert ... on conflict do nothing`).
3. Evite operações destrutivas sem necessidade; uma migration roda inteira numa
   transação — se falhar no meio, nada é gravado.
4. Faça commit do `.sql`. No próximo deploy, rode o serviço `migrate`.

> **Não edite** uma migration já aplicada em produção — crie uma nova.
