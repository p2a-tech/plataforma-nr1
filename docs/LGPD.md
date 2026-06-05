# LGPD — Consentimento & Retenção

PrevIA é privacy-first: **não armazena PII**. O telefone só existe como hash
sha256 (`telefone_hash`), que é pseudônimo e irreversível. Respostas de pulso
são anônimas e agregadas por cluster (setor/turno), nunca exibidas
individualmente (k-anonymity k≥7 na leitura).

## Modelo de consentimento (E7.1)

- **Opt-in anônimo via WhatsApp.** O consentimento acontece no momento em que o
  trabalhador responde a **energia** do micro-pulso (botão `e:...`). Esse ato é
  o opt-in explícito (base legal: consentimento — art. 7º, I, LGPD).
- **Termo versionado.** `termos_consentimento (versao pk, texto, vigente,
  criado_em)` guarda o texto do termo. Exatamente um termo fica `vigente`. O
  termo vigente atual é a `v1` (texto curto em pt-BR sobre pulsos anônimos).
- **Registro do opt-in.** No webhook (`app/api/webhook/whatsapp/route.ts`), ao
  receber a energia:
  - `pulso_sessoes.consentido_em = now()` e `pulso_sessoes.termo_versao =
    <versão vigente>` (preservados em reentrâncias via `coalesce`).
  - insere uma linha no livro-razão durável `consentimentos (telefone_hash,
    termo_versao, canal='whatsapp', concedido_em)`.
- **Sem PII.** Tanto `pulso_sessoes` quanto `consentimentos` usam apenas
  `telefone_hash` (pseudônimo). `consentimentos` sobrevive à expiração da sessão
  e serve como prova de consentimento.

## Política de retenção (E7.2)

Definida em `lib/lgpd.ts` (server-only) e replicada em `scripts/retencao.mjs`:

| Tabela              | Janela                  | Ação    | Motivo                                  |
| ------------------- | ----------------------- | ------- | --------------------------------------- |
| `pulso_respostas`   | `RETENCAO_MESES` (12)   | delete  | já são anônimas — delete é suficiente   |
| `pulso_sessoes`     | `SESSOES_DIAS` (30)     | delete  | estado de conversa efêmero/abandonado   |
| `webhook_audit_log` | `RETENCAO_MESES` (12)   | delete  | log operacional                         |

Como `pulso_respostas` não contém PII nem identificador de pessoa, a remoção
direta já satisfaz a anonimização em definitivo.

## Direito à exclusão (DSAR / right to erasure)

O titular é localizável apenas pelo `telefone_hash` (derive com
`hashTelefone(numero)` de `lib/whatsapp.ts`). Para atender a um pedido de
exclusão:

```sql
-- substitua :hash pelo telefone_hash do titular
delete from public.pulso_sessoes  where telefone_hash = :hash;
delete from public.consentimentos where telefone_hash = :hash;
```

As respostas em `pulso_respostas` **não** têm vínculo com a pessoa (são
anônimas), então não há o que apagar lá para um indivíduo — é exatamente o
objetivo do design.

## Executando a retenção

O job vive em `scripts/retencao.mjs` e usa `DATABASE_URL` (mesma heurística de
SSL de `lib/db.ts`):

```bash
# padrão = dry-run: só CONTA o que seria removido (não apaga nada)
node scripts/retencao.mjs --dry-run

# APLICA: remove de fato as linhas expiradas
node scripts/retencao.mjs --apply
```

**Cron recomendado** (diário, 03:00):

```cron
0 3 * * *  cd /app && node scripts/retencao.mjs --apply >> /var/log/previa-retencao.log 2>&1
```

Ambos os modos imprimem um relatório por tabela. Comece sempre com `--dry-run`
ao validar mudanças de janela.
