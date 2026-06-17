-- ============================================================================
-- 0025 · Notificações in-app: marca de leitura (Onda 8 · Dev A)
-- ----------------------------------------------------------------------------
-- Fecha o loop das notificações: até a Onda 7 só `lib/notify.ts` ESCREVIA em
-- `public.notificacoes` (trilha de despacho criada na mig 0020); ninguém LIA nem
-- exibia. A camada de leitura (lib/notificacoes.ts + /notificacoes + sino no
-- header) precisa de um estado "lida/não lida" por notificação.
--
-- Adiciona `lida_em timestamptz` (NULL = não lida) e os índices que sustentam:
--   - a listagem por empresa ordenada por data (mig 0020 já tem o equivalente
--     `notificacoes_empresa_criado_idx`; reafirmado aqui sob o mesmo nome para
--     ser idempotente e auto-documentado);
--   - a contagem de NÃO LIDAS (índice parcial WHERE lida_em IS NULL — leve e
--     muito seletivo conforme as notificações vão sendo marcadas como lidas).
--
-- RLS: mantém a decisão da mig 0020 — `notificacoes` é trilha de observabilidade
-- global (mistura empresa_id NULL e não-NULL), acessada via `sqlAdmin`. NÃO
-- habilitamos RLS aqui. O escopo por empresa (sst só vê/marca da própria) é
-- aplicado na camada lib/notificacoes.ts (WHERE empresa_id = ...).
--
-- GRANT: a mig 0020 já concedeu select/insert/update em notificacoes a
-- `previa_app`; o UPDATE cobre a marcação de leitura. Reafirmado aqui (idempotente).
--
-- Tudo idempotente: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / GRANT
-- são re-aplicáveis sem erro.
-- ============================================================================

-- ── marca de leitura ────────────────────────────────────────────────────────
alter table public.notificacoes
  add column if not exists lida_em timestamptz;

comment on column public.notificacoes.lida_em is
  'Quando a notificação foi marcada como lida no painel in-app. NULL = não lida.';

-- Listagem por empresa, mais recentes primeiro (já existe desde a 0020; reafirma).
create index if not exists notificacoes_empresa_criado_idx
  on public.notificacoes (empresa_id, criado_em desc);

-- Contagem de não lidas: índice parcial (só linhas com lida_em IS NULL).
create index if not exists notificacoes_nao_lidas_idx
  on public.notificacoes (empresa_id, criado_em desc)
  where lida_em is null;

-- Defesa em profundidade: UPDATE necessário p/ marcar leitura (mig 0020 já deu).
grant select, insert, update on public.notificacoes to previa_app;
