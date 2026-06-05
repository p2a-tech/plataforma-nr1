-- ============================================================================
-- 0006 · Row Level Security (defesa em profundidade do multi-tenancy)
--
-- Cria a role `previa_app` (sem superuser, sem bypass de RLS) e políticas em
-- TODAS as tabelas com `empresa_id`. A aplicação conecta com essa role e seta
-- `app.empresa_id` em CADA transação. O Postgres recusa linhas de outra empresa
-- mesmo que uma query app-level esqueça o `where empresa_id = ...`.
--
-- Política simples e uniforme: USING e WITH CHECK = empresa_id = setting.
-- - leitura cross-tenant: bloqueada (filtra linhas).
-- - escrita cross-tenant: bloqueada (rejeita INSERT/UPDATE).
--
-- Quando `app.empresa_id` não está setado, NENHUMA linha é visível
-- (fail-closed). O webhook usa pseudo-empresa 'emp_unscoped' para audit antes
-- de identificar a clínica.
--
-- O usuário `previa` (super) mantém acesso total — usado por migrations/scripts.
-- ============================================================================

-- 1) Role da aplicação
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'previa_app') then
    -- senha é a mesma do super em dev; em prod usar segredo dedicado.
    create role previa_app login password 'previa_app_pwd' nosuperuser nobypassrls;
  end if;
end$$;

-- Permite que previa_app use o schema public e suas tabelas.
grant usage on schema public to previa_app;
grant select, insert, update, delete on all tables in schema public to previa_app;
grant usage, select on all sequences in schema public to previa_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to previa_app;
alter default privileges in schema public
  grant usage, select on sequences to previa_app;

-- 2) Função helper (idempotente) — retorna o escopo atual ou NULL.
create or replace function public.empresa_escopo()
returns text
language sql stable
as $$ select current_setting('app.empresa_id', true) $$;

-- 3) Habilita RLS em cada tabela escopada e define política.
--    Loop padronizado para garantir consistência total.
do $$
declare
  t text;
  tabelas text[] := array[
    'empresas','clinicas','eventos_agregados','pulso_alvos','pulso_respostas',
    'pulso_sessoes','webhook_audit_log','pgr_assinaturas','usuarios','consentimentos'
  ];
begin
  foreach t in array tabelas loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- drop existing policy (idempotência)
    execute format('drop policy if exists tenant_isolation on public.%I', t);
  end loop;
end$$;

-- 3a) Tabela `empresas`: visível a todas as empresas do escopo (id == escopo)
--     + role super tem tudo. Política específica.
create policy tenant_isolation on public.empresas
  for all to previa_app
  using (id = public.empresa_escopo())
  with check (id = public.empresa_escopo());

-- 3b) Demais tabelas: filtram por `empresa_id`.
create policy tenant_isolation on public.clinicas
  for all to previa_app
  using (empresa_id = public.empresa_escopo())
  with check (empresa_id = public.empresa_escopo());

create policy tenant_isolation on public.eventos_agregados
  for all to previa_app
  using (empresa_id = public.empresa_escopo())
  with check (empresa_id = public.empresa_escopo());

create policy tenant_isolation on public.pulso_alvos
  for all to previa_app
  using (empresa_id = public.empresa_escopo())
  with check (empresa_id = public.empresa_escopo());

create policy tenant_isolation on public.pulso_respostas
  for all to previa_app
  using (empresa_id = public.empresa_escopo())
  with check (empresa_id = public.empresa_escopo());

create policy tenant_isolation on public.pulso_sessoes
  for all to previa_app
  using (empresa_id = public.empresa_escopo())
  with check (empresa_id = public.empresa_escopo());

create policy tenant_isolation on public.webhook_audit_log
  for all to previa_app
  using (empresa_id = public.empresa_escopo())
  with check (empresa_id = public.empresa_escopo());

create policy tenant_isolation on public.pgr_assinaturas
  for all to previa_app
  using (empresa_id = public.empresa_escopo())
  with check (empresa_id = public.empresa_escopo());

create policy tenant_isolation on public.usuarios
  for all to previa_app
  using (empresa_id = public.empresa_escopo())
  with check (empresa_id = public.empresa_escopo());

create policy tenant_isolation on public.consentimentos
  for all to previa_app
  using (empresa_id = public.empresa_escopo())
  with check (empresa_id = public.empresa_escopo());

-- 4) `ofensores_evento` não tem empresa_id (escopo herdado de eventos_agregados).
--    Política referencia o pai. RLS habilitado + política.
alter table public.ofensores_evento enable row level security;
alter table public.ofensores_evento force row level security;
drop policy if exists tenant_isolation on public.ofensores_evento;
create policy tenant_isolation on public.ofensores_evento
  for all to previa_app
  using (
    exists (select 1 from public.eventos_agregados e
             where e.id = ofensores_evento.evento_id
               and e.empresa_id = public.empresa_escopo())
  )
  with check (
    exists (select 1 from public.eventos_agregados e
             where e.id = ofensores_evento.evento_id
               and e.empresa_id = public.empresa_escopo())
  );

-- 5) `termos_consentimento` e `config_governanca` são GLOBAIS — sem RLS
--    (a primeira é referência; a segunda é demo de governança).
--    Marcadas explicitamente para deixar a intenção clara.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'termos_consentimento') then
    alter table public.termos_consentimento disable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'config_governanca') then
    alter table public.config_governanca disable row level security;
  end if;
end$$;

-- 6) Login da clínica precisa LER o `usuarios` SEM escopo prévio (ovo-e-galinha:
--    descobrimos a empresa pelo próprio login). Criamos uma role separada para o
--    handler de auth, que pode ler usuarios+empresas+clinicas. NÃO insere/atualiza.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'previa_auth') then
    create role previa_auth login password 'previa_auth_pwd' nosuperuser bypassrls;
    -- bypassrls está intencional aqui: só LE usuarios para autenticar. Em prod,
    -- pode-se restringir mais via grants/views. Por hora, segurança pragmática.
    grant connect on database previa to previa_auth;
    grant usage on schema public to previa_auth;
    grant select on public.usuarios, public.empresas, public.clinicas to previa_auth;
  end if;
end$$;
