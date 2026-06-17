-- ============================================================================
-- 0026 · Plano de Ação · acompanhamento + vencimentos — Onda 9 · Dev A
-- ----------------------------------------------------------------------------
-- Estende public.plano_acao (criada em 0014) para suportar a tela de
-- acompanhamento (/conformidade/acoes):
--
--   - concluido_em            : carimbo de quando o plano virou 'concluido'.
--                               Setado/limpo em atualizarStatusPlano (lib).
--   - notificado_vencimento_em: guard de idempotência — uma vez que o aviso de
--                               vencimento foi disparado para um plano, esta
--                               coluna é preenchida e verificarVencimentos não
--                               notifica de novo (1 aviso por plano).
--
-- Índice (empresa_id, status, prazo) acelera o resumo da tela (contagem por
-- status, vencidos = prazo < hoje, a vencer em 7d) sem varrer a tabela inteira.
--
-- TODAS as alterações são idempotentes (IF NOT EXISTS) — seguras para rodar no
-- boot quantas vezes for preciso.
-- ============================================================================

-- ── Guard: garante que a tabela do plano de ação (0014) já existe ───────────
do $$
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'plano_acao'
  ) then
    raise exception '0026 requer 0014 (plano_acao). Aplique a migration do plano de ação primeiro.';
  end if;
end$$;

-- ── Novas colunas (aditivas, idempotentes) ──────────────────────────────────
alter table public.plano_acao
  add column if not exists concluido_em timestamptz;

alter table public.plano_acao
  add column if not exists notificado_vencimento_em timestamptz;

comment on column public.plano_acao.concluido_em is
  'Quando o plano passou para status=concluido (limpo se sair de concluido).';
comment on column public.plano_acao.notificado_vencimento_em is
  'Guard de idempotência do aviso de vencimento — uma vez setado, não re-notifica.';

-- ── Índice de apoio à tela de acompanhamento ────────────────────────────────
-- Cobre: contagem por status, vencidos (status pendente|em_andamento + prazo <
-- hoje) e "a vencer em 7d". Complementa os índices de 0014 (que ordenam por
-- criado_em); este prioriza o prazo.
create index if not exists plano_acao_emp_status_prazo_idx
  on public.plano_acao (empresa_id, status, prazo);
