-- ============================================================================
-- 0014 · Plano de Ação (Prevencionista vs Interventivo) — Onda 4 · Dev B
-- ----------------------------------------------------------------------------
-- §5 do BACKLOG_OKEBAMBO. Duas tabelas:
--   - `acao_recomendada` (catálogo GLOBAL): catálogo de ações sugeridas para
--     cada programa (prevencionista|interventivo) e, opcionalmente, dimensão
--     ou fator NR-1 específicos. Não tem empresa_id → sem RLS por empresa.
--     GRANT SELECT para previa_app (todo o tenant lê o mesmo catálogo).
--   - `plano_acao` (TENANT, RLS forced): plano instanciado pela empresa para
--     um fator específico (pode ser baseado em ação do catálogo ou customizado).
--
-- Depende de tabelas que o Dev A criou em 0011-0013:
--   - dim_nr1 (5 dimensões)
--   - fator_nr1 (35 fatores, FK dim_id)
-- Migration falha cedo se essas tabelas não existirem (lock-in de ordem).
-- ============================================================================

-- ── Guard: garante que o catálogo NR-1 do Dev A já existe ───────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'fator_nr1'
  ) then
    raise exception '0014 requer 0011 (fator_nr1). Aplique as migrations do Dev A primeiro.';
  end if;
end$$;

-- ── 1) Catálogo global de ações recomendadas ───────────────────────────────
create table if not exists public.acao_recomendada (
  id                  text primary key,
  programa            text not null check (programa in ('prevencionista','interventivo')),
  -- dim_id permite filtrar ações por dimensão NR-1 (5 dimensões). NULL = vale
  -- para todas as dimensões (ação transversal, ex.: ativar protocolo de risco).
  dim_id              text references public.dim_nr1(id) on delete set null,
  -- fator_id permite uma ação atrelada a um fator específico. NULL = vale
  -- para todos os fatores da dimensão (caso geral).
  fator_id            text references public.fator_nr1(id) on delete set null,
  titulo              text not null,
  como_realizar       text not null,
  responsavel_padrao  text,
  criado_em           timestamptz not null default now()
);

comment on table public.acao_recomendada is
  'Catálogo global de ações recomendadas (BACKLOG §5). Sem RLS — todo tenant lê o mesmo catálogo.';

-- Sem RLS na tabela (catálogo global). Garantimos GRANT SELECT pra previa_app.
grant select on public.acao_recomendada to previa_app;

create index if not exists acao_recomendada_programa_idx
  on public.acao_recomendada (programa, dim_id);

-- ── 2) Plano de ação instanciado pela empresa ──────────────────────────────
create table if not exists public.plano_acao (
  id                   uuid primary key default gen_random_uuid(),
  empresa_id           text not null references public.empresas(id) on delete restrict,
  fator_id             text not null references public.fator_nr1(id) on delete restrict,
  -- classificação calculada (baixo|moderado|alto) no momento da criação.
  -- Não é atualizada automaticamente; ao re-classificar, abrir novo plano.
  classificacao        text not null check (classificacao in ('baixo','moderado','alto')),
  programa             text not null check (programa in ('prevencionista','interventivo')),
  -- Se foi instanciado a partir do catálogo, mantém o link (mas a ação pode
  -- ter sido customizada localmente — titulo_custom/como_realizar_custom).
  acao_id              text references public.acao_recomendada(id) on delete set null,
  titulo_custom        text,
  como_realizar_custom text,
  responsavel          text not null,
  prazo                date,
  status               text not null default 'pendente'
                       check (status in ('pendente','em_andamento','concluido','cancelado')),
  criado_em            timestamptz not null default now(),
  criado_por           text not null,
  atualizado_em        timestamptz
);

comment on table public.plano_acao is
  'Plano de ação atribuído a uma empresa+fator NR-1 (BACKLOG §5). RLS forced por empresa_id.';

create index if not exists plano_acao_emp_status_idx
  on public.plano_acao (empresa_id, status, criado_em desc);
create index if not exists plano_acao_emp_fator_idx
  on public.plano_acao (empresa_id, fator_id);

-- ── RLS forced por empresa_id ───────────────────────────────────────────────
alter table public.plano_acao enable row level security;
alter table public.plano_acao force row level security;
drop policy if exists tenant_isolation on public.plano_acao;
create policy tenant_isolation on public.plano_acao
  for all to previa_app
  using (empresa_id = current_setting('app.empresa_id', true))
  with check (empresa_id = current_setting('app.empresa_id', true));

grant select, insert, update on public.plano_acao to previa_app;

-- ── 3) Seed idempotente do catálogo Okêbambo (16 ações = 10 prev + 6 inter) ─
-- Vide §5 do BACKLOG. Os fator_id/dim_id ficam NULL quando a ação é
-- transversal (ex.: "Estabelecer intervalos mínimos" vale para vários fatores
-- da dimensão "Organização do trabalho"). O sugeridor de plano filtra pela
-- dimensão do fator quando o fator_id da ação é NULL e dim_id casa.
--
-- IDs estáveis (prefixo 'aco_') para facilitar referência em testes e PRs.

insert into public.acao_recomendada
  (id, programa, dim_id, fator_id, titulo, como_realizar, responsavel_padrao)
values
  -- Prevencionista (10) — riscos baixo|moderado
  ('aco_intervalos_minimos', 'prevencionista', 'org_trabalho', null,
   'Estabelecer intervalos mínimos entre atendimentos',
   'Definir politica de pausas obrigatórias entre sessões clínicas. Mínimo 10 min entre atendimentos, 30 min a cada 3h de trabalho contínuo. Inserir na agenda do sistema.',
   'Coordenação Técnica'),

  ('aco_limite_diario', 'prevencionista', 'org_trabalho', null,
   'Definir limite diário de pacientes por profissional',
   'Acordar com cada profissional o teto de atendimentos/dia conforme função e contrato. Documentar em política interna. Revisar a cada 6 meses.',
   'Coordenação Técnica'),

  ('aco_supervisao_clinica', 'prevencionista', 'relacoes', null,
   'Agendar reuniões periódicas de supervisão clínica',
   'Reunião semanal ou quinzenal por equipe, com pauta estruturada (casos difíceis, protocolos, atualização técnica). Registrar em ata.',
   'Coordenação Técnica'),

  ('aco_escuta_entre_profissionais', 'prevencionista', 'relacoes', null,
   'Criar espaços de escuta entre profissionais',
   'Espaços formais de fala entre pares (grupos de discussão, círculos de cuidado). Periodicidade mínima mensal. Garantir confidencialidade.',
   'Coordenação Técnica'),

  ('aco_treinamento_crises', 'prevencionista', 'carga_emocional', null,
   'Promover treinamento para manejo de crises',
   'Capacitar a equipe em técnicas de contenção, manejo de pacientes em crise emocional e auto-cuidado pós-evento crítico. Carga mínima 8h/ano por profissional.',
   'Coordenação Técnica'),

  ('aco_ajustes_agenda', 'prevencionista', 'org_trabalho', null,
   'Ajustes operacionais na agenda',
   'Revisar a agenda de cada profissional eliminando overbooking, encaixes excessivos e falta de blocos para registro. Implementar regra "agenda fechada" 1x/semana.',
   'Administrativa'),

  ('aco_tempo_registros', 'prevencionista', 'org_trabalho', null,
   'Reservar tempo dedicado para registros clínicos',
   'Bloquear na agenda 15-20 min após cada atendimento para registro. Garantir que a soma não passa de 8h totais de jornada.',
   'Coordenação Técnica'),

  ('aco_salas_silenciosas', 'prevencionista', 'condicoes', null,
   'Garantir salas silenciosas e organizadas',
   'Inspecionar mensalmente as salas: isolamento acústico, ventilação, iluminação, mobiliário. Aplicar plano de melhoria onde houver gap.',
   'Apoio'),

  ('aco_privacidade_atendimento', 'prevencionista', 'condicoes', null,
   'Garantir privacidade durante atendimentos',
   'Verificar isolamento visual e auditivo das salas. Implementar sinalização "atendimento em curso". Sala não pode ser interrompida sem motivo de emergência.',
   'Apoio'),

  ('aco_ergonomia', 'prevencionista', 'condicoes', null,
   'Ajustar mobiliário para conforto ergonômico',
   'Avaliação ergonômica por SESMT ou consultoria. Cadeiras com regulagem, monitores na altura correta, apoio para os pés/punhos. Trocar mobiliário inadequado.',
   'Administrativa'),

  -- Interventivo (6) — riscos alto|crítico
  ('aco_encaminhamento_clinica', 'interventivo', null, null,
   'Encaminhamento individual à clínica parceira (NR-7)',
   'Acionar a clínica parceira para avaliação clínica individual do profissional impactado. Registro no PCMSO. Sigilo médico mantido — empresa só recebe ata sem PII.',
   'SESMT / NR-7'),

  ('aco_suspensao_exposicao', 'interventivo', null, null,
   'Suspensão temporária da exposição ao fator',
   'Redirecionar a agenda do profissional para reduzir contato com o fator de risco (ex.: pausa em atendimentos de casos complexos). Período sugerido: 14-30 dias com reavaliação.',
   'Coordenação Técnica'),

  ('aco_investigacao_cipa_dpo', 'interventivo', null, null,
   'Investigação raiz pela CIPA + DPO',
   'Abrir investigação formal: ouvir testemunhas (sem PII de pacientes), levantar histórico do setor, mapear causa-raiz organizacional. Prazo: 30 dias. Relatório arquivado no PGR.',
   'CIPA + DPO'),

  ('aco_protocolo_risco_grave', 'interventivo', 'seguranca_emoc', null,
   'Ativar o protocolo de risco grave/iminente (E8)',
   'Se houver indicador de emergência (ideação, violência iminente, surto), acionar o protocolo já implementado em /escuta/risco-grave. Notificação imediata DPO + acompanhamento.',
   'SESMT'),

  ('aco_plano_retorno', 'interventivo', null, null,
   'Plano de retorno acompanhado com responsável técnico',
   'Após afastamento ou suspensão, plano de retorno gradual: redução de carga inicial (50%), reavaliação semanal, alta supervisionada pelo responsável técnico (CRP/CRM).',
   'Coordenação Técnica + Clínica parceira'),

  ('aco_revisao_mudancas', 'interventivo', 'org_trabalho', null,
   'Revisão de mudanças organizacionais recentes',
   'Mapear as mudanças dos últimos 12 meses (estrutura, processos, lideranças) e correlacionar com o aumento do fator de risco. Reverter ou ajustar as que tiveram impacto negativo.',
   'Diretoria + Coordenação')

on conflict (id) do update
  set programa = excluded.programa,
      dim_id = excluded.dim_id,
      fator_id = excluded.fator_id,
      titulo = excluded.titulo,
      como_realizar = excluded.como_realizar,
      responsavel_padrao = excluded.responsavel_padrao;
