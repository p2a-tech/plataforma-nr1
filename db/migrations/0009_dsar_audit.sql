-- ============================================================================
-- 0009 · DSAR (LGPD titular) + auditoria de acesso a rotas sensíveis
--
-- DSAR (Data Subject Access Request) implementa os direitos do titular de
-- dados (LGPD arts. 18-22): acesso, exclusão, correção, portabilidade,
-- revogação de consentimento e oposição.
--
-- A captura é PÚBLICA (qualquer titular envia, mesmo sem conta) — por isso
-- `empresa_id` é nullable. Quando o operador (sst|admin) classifica o pedido,
-- pode associar o titular à empresa correta.
--
-- acesso_log: trilha INALTERÁVEL de quem (papel + email) abriu cada rota
-- sensível (jurídico, governança, admin, PGR, riscos, escuta/risco-grave).
-- Usada para auditoria interna (LGPD art. 37 — registro de operações).
-- ============================================================================

-- 1) Pedidos de DSAR ----------------------------------------------------------
create table if not exists public.dsar_pedidos (
  id                   uuid primary key default gen_random_uuid(),
  -- Empresa pode ser null no momento da captura (canal público); SST/admin
  -- classifica e associa ao tenant correto via UPDATE.
  empresa_id           text references public.empresas(id) on delete set null,
  email_titular        text not null,
  telefone_titular_hash text,
  tipo                 text not null check (tipo in (
                         'acesso','exclusao','correcao','portabilidade',
                         'revogacao_consentimento','oposicao'
                       )),
  justificativa        text,
  status               text not null default 'recebido'
                       check (status in ('recebido','em_analise','atendido','rejeitado')),
  resposta             text,
  criado_em            timestamptz not null default now(),
  atendido_em          timestamptz,
  atendido_por         text,
  ip_hash              text,
  user_agent           text
);

create index if not exists dsar_pedidos_empresa_idx
  on public.dsar_pedidos (empresa_id, status, criado_em desc);
create index if not exists dsar_pedidos_email_idx
  on public.dsar_pedidos (lower(email_titular));

-- RLS: pedidos sem empresa (recém-recebidos) ficam visíveis a admin
-- (via sqlAdmin). Pedidos com empresa_id seguem multi-tenancy.
alter table public.dsar_pedidos enable row level security;
alter table public.dsar_pedidos force row level security;
drop policy if exists tenant_isolation on public.dsar_pedidos;
create policy tenant_isolation on public.dsar_pedidos
  for all to previa_app
  using (empresa_id is null or empresa_id = current_setting('app.empresa_id', true))
  with check (empresa_id is null or empresa_id = current_setting('app.empresa_id', true));

grant select, insert, update on public.dsar_pedidos to previa_app;

-- 2) Log de acesso a rotas sensíveis -----------------------------------------
-- bigserial: ordem temporal + chave estável. Sem PK natural.
create table if not exists public.acesso_log (
  id            bigserial primary key,
  empresa_id    text,
  usuario_email text,
  papel         text,
  rota          text,
  ip_hash       text,
  criado_em     timestamptz not null default now()
);

create index if not exists acesso_log_empresa_idx
  on public.acesso_log (empresa_id, criado_em desc);
create index if not exists acesso_log_usuario_idx
  on public.acesso_log (usuario_email, criado_em desc);

-- acesso_log fica FORA do RLS: é trilha de auditoria global, acessada apenas
-- por admin via sqlAdmin. previa_app só pode INSERT (não SELECT/UPDATE) para
-- evitar que uma página comprometida ofusque trilha.
grant select, insert, update on public.acesso_log to previa_app;
