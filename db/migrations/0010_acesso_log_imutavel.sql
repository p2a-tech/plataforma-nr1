-- ============================================================================
-- 0010 · acesso_log imutável (corrige divergência do grant da 0009)
--
-- Problema: a 0009 declarou `acesso_log` como "trilha INALTERÁVEL" mas concedeu
-- `select, insert, update` ao role `previa_app`. Resultado: uma rota
-- comprometida poderia apagar (UPDATE em colunas) ou enumerar (SELECT) a
-- auditoria — o oposto do invariante prometido.
--
-- Esta migration:
--   1. Revoga todos os grants atuais de `previa_app` em `public.acesso_log`.
--   2. Concede APENAS `insert` — append-only, sem leitura nem mutação.
--   3. Leitura administrativa (governança, exportação para DPO) só via
--      `sqlAdmin` (role super), em rota futura de admin.
--
-- IMPORTANTE: `lib/audit-access.ts` já usa `sqlAdmin` para gravar; este
-- INSERT continuaria funcionando mesmo sem o grant (super bypassa). O grant
-- explícito de INSERT em `previa_app` é defesa em profundidade caso, no
-- futuro, alguém migre a escrita para o cliente em escopo (sql/withEmpresa).
-- ============================================================================

revoke all on public.acesso_log from previa_app;

grant insert on public.acesso_log to previa_app;

-- Documentação operacional inline (visível em \dp public.acesso_log):
comment on table public.acesso_log is
  'Trilha imutável de acesso a rotas sensíveis (LGPD art. 37). '
  'previa_app só tem INSERT — SELECT/UPDATE/DELETE são deliberadamente '
  'bloqueados. Leitura para auditoria interna só via sqlAdmin (role super) '
  'em rota administrativa dedicada.';
