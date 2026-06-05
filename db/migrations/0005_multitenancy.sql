-- 0005 · Multi-tenancy (E5)
-- Cria tabela `empresas` e adiciona `empresa_id` em todas as tabelas que
-- carregam dado escopado por cliente. Backfill: tudo o que existe hoje
-- pertence a 'emp_translog' (cliente piloto).
-- ============================================================================

create table if not exists public.empresas (
  id         text primary key,
  nome       text not null,
  cnpj       text,
  segmento   text,
  ativa      boolean not null default true,
  criada_em  timestamptz not null default now()
);

-- Empresa-piloto (mesma "Translog" que estava como constante no mock).
insert into public.empresas (id, nome, cnpj, segmento)
values ('emp_translog', 'Translog Brasil S.A.', '12.345.678/0001-90', 'Logística e Transporte')
on conflict (id) do nothing;

-- Pseudo-empresa para auditoria de webhooks rejeitados ANTES de identificar a
-- clínica (e portanto antes de saber a empresa real).
insert into public.empresas (id, nome, ativa)
values ('emp_unscoped', '(auditoria sem escopo)', true)
on conflict (id) do nothing;

-- ── empresa_id em todas as tabelas ─────────────────────────────────────────
alter table public.clinicas           add column if not exists empresa_id text references public.empresas(id) on delete restrict;
alter table public.eventos_agregados  add column if not exists empresa_id text references public.empresas(id) on delete restrict;
alter table public.pulso_alvos        add column if not exists empresa_id text references public.empresas(id) on delete restrict;
alter table public.pulso_respostas    add column if not exists empresa_id text references public.empresas(id) on delete restrict;
alter table public.pulso_sessoes      add column if not exists empresa_id text references public.empresas(id) on delete restrict;
alter table public.webhook_audit_log  add column if not exists empresa_id text references public.empresas(id) on delete restrict;
alter table public.pgr_assinaturas    add column if not exists empresa_id text references public.empresas(id) on delete restrict;
alter table public.usuarios           add column if not exists empresa_id text references public.empresas(id) on delete restrict;
alter table public.consentimentos     add column if not exists empresa_id text references public.empresas(id) on delete restrict;

-- ── Backfill: tudo o que já existe é da empresa-piloto ─────────────────────
update public.clinicas          set empresa_id = 'emp_translog' where empresa_id is null;
update public.eventos_agregados set empresa_id = 'emp_translog' where empresa_id is null;
update public.pulso_alvos       set empresa_id = 'emp_translog' where empresa_id is null;
update public.pulso_respostas   set empresa_id = 'emp_translog' where empresa_id is null;
update public.pulso_sessoes     set empresa_id = 'emp_translog' where empresa_id is null;
update public.webhook_audit_log set empresa_id = 'emp_translog' where empresa_id is null;
update public.pgr_assinaturas   set empresa_id = 'emp_translog' where empresa_id is null;
update public.usuarios          set empresa_id = 'emp_translog' where empresa_id is null;
update public.consentimentos    set empresa_id = 'emp_translog' where empresa_id is null;

-- ── Constraints NOT NULL após backfill ─────────────────────────────────────
alter table public.clinicas           alter column empresa_id set not null;
alter table public.eventos_agregados  alter column empresa_id set not null;
alter table public.pulso_alvos        alter column empresa_id set not null;
alter table public.pulso_respostas    alter column empresa_id set not null;
alter table public.webhook_audit_log  alter column empresa_id set not null;
alter table public.pgr_assinaturas    alter column empresa_id set not null;
alter table public.usuarios           alter column empresa_id set not null;
-- pulso_sessoes e consentimentos podem ter linhas anteriores ao backfill (não)
alter table public.pulso_sessoes      alter column empresa_id set not null;
alter table public.consentimentos     alter column empresa_id set not null;

-- ── Índices para escopo por empresa ────────────────────────────────────────
create index if not exists eventos_agregados_emp_iniciada_idx
  on public.eventos_agregados (empresa_id, iniciada_em desc);
create index if not exists eventos_agregados_emp_heatmap_idx
  on public.eventos_agregados (empresa_id, cluster_setor, cluster_turno);
create index if not exists pulso_respostas_emp_idx
  on public.pulso_respostas (empresa_id, respondido_em desc);
create index if not exists pulso_respostas_emp_cluster_idx
  on public.pulso_respostas (empresa_id, cluster_setor, cluster_turno);
create index if not exists pulso_alvos_emp_idx
  on public.pulso_alvos (empresa_id);
create index if not exists webhook_audit_emp_idx
  on public.webhook_audit_log (empresa_id, recebido_em desc);
create index if not exists pgr_assinaturas_emp_idx
  on public.pgr_assinaturas (empresa_id, assinado_em desc);
create index if not exists usuarios_emp_idx
  on public.usuarios (empresa_id);
create index if not exists clinicas_emp_idx
  on public.clinicas (empresa_id);
