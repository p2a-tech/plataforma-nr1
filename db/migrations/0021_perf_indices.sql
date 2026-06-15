-- 0021_perf_indices.sql
-- E10 · Performance: índices nas colunas quentes das telas SST de leitura.
-- TODOS additivos e idempotentes (CREATE INDEX IF NOT EXISTS). Seguros para
-- rodar quantas vezes for preciso — nunca quebram nem duplicam.
--
-- Vários índices equivalentes já nasceram nas migrations anteriores (0001, 0005,
-- 0007, 0008, 0009, 0013). Aqui apenas (a) garantimos que existem e (b)
-- adicionamos os que ainda faltam para as queries de leitura do dashboard,
-- escuta, riscos, conformidade, governança e jurídico.

-- ── pulso_respostas (Escuta / Dashboard / heatmap) ─────────────────────────
-- Janela temporal por empresa (série diária, "respostas na semana"): já existe
-- como pulso_respostas_emp_idx (0005). Reafirmamos sob nome canônico.
create index if not exists pulso_respostas_emp_data_idx
  on public.pulso_respostas (empresa_id, respondido_em desc);

-- Agrupamento por setor por empresa (sinais por setor / heatmap). O índice
-- existente (0005) é (empresa_id, cluster_setor, cluster_turno); este prefixo
-- só por setor acelera os group-by que não filtram turno.
create index if not exists pulso_respostas_emp_setor_idx
  on public.pulso_respostas (empresa_id, cluster_setor);

-- ── DRPS (Riscos / Análise NR-1) ───────────────────────────────────────────
-- Respostas DRPS por empresa em ordem cronológica: já existe (0013).
create index if not exists drps_resposta_emp_data_idx
  on public.drps_resposta (empresa_id, respondido_em desc);

-- Itens por resposta (join quente ao agregar respostas → fatores): já existe
-- (0013). Reafirmado para a contagem por fator/dimensão na tela de Riscos.
create index if not exists drps_resposta_item_resp_idx
  on public.drps_resposta_item (resposta_id);

-- ── eventos_risco_grave (Jurídico / resumo) ────────────────────────────────
-- Listagem de eventos abertos por empresa: já existe (0008). Reafirmado.
create index if not exists eventos_risco_grave_emp_status_idx
  on public.eventos_risco_grave (empresa_id, status, criado_em desc);

-- ── dsar_pedidos (Jurídico / DSAR) ─────────────────────────────────────────
-- Fila de pedidos por status dentro da empresa. O índice de 0009 é
-- (empresa_id, status, criado_em desc); este prefixo (empresa_id, status)
-- cobre o filtro por status sem exigir a coluna de data.
create index if not exists dsar_pedidos_emp_status_idx
  on public.dsar_pedidos (empresa_id, status);

-- ── leads_lp (Admin / funil — leitura quente) ──────────────────────────────
-- Listagem de leads mais recentes primeiro: já existe (0007). Reafirmado.
create index if not exists leads_lp_criado_idx
  on public.leads_lp (criado_em desc);
