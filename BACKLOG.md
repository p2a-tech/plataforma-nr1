# PrevIA · Backlog para Produção (v1)

> Estado atual: protótipo navegável evoluído para **produto funcional** com dados reais
> em Postgres. Faltam as camadas de robustez, segurança, multi-tenancy e operação que
> caracterizam um v1 **production-ready**. Este backlog cobre esse gap.
>
> Prioridades: **P0** (bloqueia produção) · **P1** (necessário para v1) · **P2** (pós-v1 desejável).
> Stack: Next.js 14 (App Router) · TS · Tailwind · Postgres · npm workspaces · `@previa/contracts`.

---

## E1 · Qualidade & Testes  (P0)
- [ ] **E1.1** Runner de testes (Vitest) configurado no monorepo.
- [ ] **E1.2** Testes do contrato/barreira (`@previa/contracts`): rejeição de campos proibidos, `.strict()`, k-anonymity, taxonomia. **Invariante crítico.**
- [ ] **E1.3** Testes de assinatura HMAC (`signing.ts`) e do selo/hash do PGR (`lib/pgr.ts`): tamper-evidence, timing-safe.
- [ ] **E1.4** Testes do motor de extração heurístico (`lib/extraction`): mapeamento de ofensores, risco grave, severidade.
- [ ] **E1.5** Testes do Radar (`lib/radar.ts`): energia→risco, validação de pulso.
- [ ] **E1.6** Testes de integração das rotas (webhook barreira, auth, radar) — happy path + rejeições.
- [ ] **E1.7** CI (GitHub Actions): lint + typecheck + test + build em cada push/PR.

## E2 · Deploy & Infraestrutura  (P0)
- [ ] **E2.1** `Dockerfile` multi-stage do app Next (output standalone) + `.dockerignore`.
- [ ] **E2.2** `docker-compose.prod.yml`: app + Postgres + reverse proxy (Caddy/TLS automático). Portas internas, sem expor o DB.
- [ ] **E2.3** Sistema de **migrations versionadas** (substituir `db/init/*` que só roda em volume novo) + runner idempotente.
- [ ] **E2.4** Rotina de **backup** do Postgres (dump agendado + retenção) e restore documentado.
- [ ] **E2.5** `.env.production.example` completo + checklist de segredos (AUTH_SECRET, PGR_SECRET, DATABASE_URL, WHATSAPP_*, CLINIC_SECRETS).
- [ ] **E2.6** `DEPLOY.md`: passo a passo para a VPS (provisionamento, TLS, env, migrate, backup).
- [ ] **E2.7** CD: build/push de imagem + deploy (webhook GHCR ou similar).

## E3 · Observabilidade & Resiliência  (P0/P1)
- [ ] **E3.1** Endpoint `/api/health` (liveness + readiness: ping no DB).
- [ ] **E3.2** Logger estruturado (JSON, níveis, requestId) — substituir `console.*` solto.
- [ ] **E3.3** Error boundaries + telas de erro/loading/not-found (App Router).
- [ ] **E3.4** Integração de error tracking (Sentry ou equivalente) — P1.
- [ ] **E3.5** Retries com backoff + dead-letter no webhook da clínica (idempotência já existe).

## E4 · Segurança  (P0)
- [~] **E4.1** `npm audit` avaliado (jun/2026): **vitest crítico** = vuln do `--ui` server, mas só usamos `vitest run` e é devDep (fora da imagem) → não aplicável; mantido 3.x por compat WDAC. **Next/postcss** = fix só no Next 16 (major/breaking); uso atual não toca os caminhos vulneráveis (sem CSP nonce, sem i18n pages-router). **Ação P1 dedicada:** upgrade Next 14→15/16 com regressão. Não rodar `npm audit fix --force` (quebra build + ambiente de teste).
- [ ] **E4.2** Rate limiting nas rotas sensíveis (auth, webhook, radar/pulso).
- [ ] **E4.3** Security headers (CSP, HSTS, X-Frame-Options, etc.) via middleware/next.config.
- [ ] **E4.4** Mover segredos de webhook da clínica de env-JSON → tabela `clinic_secrets` (cifrado) com rotação.
- [ ] **E4.5** Hardening de cookies de sessão (já httpOnly; revisar SameSite/secure/rotação) + expiração/refresh.
- [ ] **E4.6** Proteção do webhook WhatsApp (assinatura já existe) + verificação de origem.

## E5 · Multi-tenancy & Modelo de Domínio  (P0)
- [ ] **E5.1** Tabela `empresas` (hoje `empresa` é constante mock) + unidades/sites.
- [ ] **E5.2** Relação clínica ↔ empresa(s) atendida(s); escopo de TODAS as queries por `empresa_id`.
- [ ] **E5.3** Migrar `pulso_*`, `eventos_agregados`, `pgr_assinaturas` para incluir `empresa_id` + índices.
- [ ] **E5.4** RLS no Postgres como defesa em profundidade.

## E6 · Autenticação & RBAC  (P0)
- [ ] **E6.1** Auth do lado **empresa/SST** (hoje só clínica tem login; dashboard/PGR estão abertos).
- [ ] **E6.2** RBAC: papéis Gestor SST, Clínica, Admin com permissões por rota/ação.
- [ ] **E6.3** Gate real em todas as rotas da plataforma (middleware/layout) por papel + empresa.
- [ ] **E6.4** Fluxo de senha: reset, política de força, lockout após N tentativas.
- [ ] **E6.5** Tela/área Admin: gerenciar empresas, clínicas, usuários, segredos.

## E7 · LGPD & Governança (real)  (P0/P1)
- [ ] **E7.1** Registro de **consentimento** (trabalhador) com timestamp e versão do termo.
- [ ] **E7.2** Política de **retenção** automatizada (job que anonimiza/expurga pulsos após N meses).
- [ ] **E7.3** Direitos do titular: exportação e exclusão de dados (DSAR).
- [ ] **E7.4** Os toggles de Governança passam a refletir/controlar configs reais (tabela `config_governanca`).
- [ ] **E7.5** Trilha de auditoria de **acesso** (quem viu o quê).

## E8 · Protocolo de Risco Grave/Iminente  (P1)
- [ ] **E8.1** Fluxo real de emergência (única exceção controlada ao anonimato) com registro e responsável.
- [ ] **E8.2** Notificação imediata (e-mail/WhatsApp) ao acionar o protocolo.

## E9 · Funcionalidades de Produto  (P1)
- [ ] **E9.1** WhatsApp real: conectar número, envio de **campanhas/waves** de pulso, agendamento, opt-out.
- [ ] **E9.2** eSocial real: geração e exportação dos eventos (S-2240 etc.) em layout válido.
- [ ] **E9.3** Exportação do **PGR em PDF** (documento assinado, com hash e selo).
- [ ] **E9.4** Notificações de alertas críticos (e-mail/in-app) para o SST.
- [ ] **E9.5** Paginação/filtros nas listas (atendimentos, pulsos, auditoria).
- [ ] **E9.6** IA real (Anthropic) plugada por padrão com chave gerenciada + fallback heurístico.

## E10 · UX, Acessibilidade & Performance  (P2)
- [ ] **E10.1** Estados de loading/skeleton em todas as telas com fetch.
- [ ] **E10.2** Acessibilidade (foco, aria, contraste) e responsividade fina.
- [ ] **E10.3** Revisão de índices/consultas + caching onde couber.
- [ ] **E10.4** Internacionalização preparada (pt-BR default).

---

## Onda 1 — em execução por agentes (frentes disjuntas, sem conflito de arquivos)
- **Agente A · QA/Testes** → E1.1–E1.5 (+ esqueleto E1.6) e script de teste.
- **Agente B · DevOps/Deploy** → E2.1–E2.6 (Dockerfile, compose prod, migrations, backup, DEPLOY.md).
- **Agente C · Observabilidade** → E3.1–E3.3 (health, logger, error/loading boundaries).
- **Revisor** → audita as três frentes: build, tipos, segurança, e o invariante da barreira.

> Ondas seguintes (sequenciais por tocarem arquivos compartilhados): E4 (segurança) → E5/E6 (multi-tenancy + auth) → E7 (LGPD) → E8/E9 (produto).
