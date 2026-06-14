-- ============================================================================
-- 0007 · Landing Page leads (captura de tráfego pago Meta + orgânico)
-- Pública: a landing /nr1 grava leads aqui sem auth.
-- LGPD: nome/email/telefone são PII; consentimento_lgpd obrigatório.
-- ============================================================================

create table if not exists public.leads_lp (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('empresa','clinica')),
  -- Identificação
  nome            text not null,
  email           text not null,
  telefone        text,
  -- Contextuais
  empresa_nome    text,
  cargo           text,
  colaboradores   int,
  conselho        text,   -- p/ clínicas: CRP/CRM
  mensagem        text,
  -- LGPD
  consentimento_lgpd boolean not null default false,
  consentimento_em   timestamptz,
  -- Atribuição (Meta Ads / orgânico)
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  fbclid          text,
  gclid           text,
  referer         text,
  user_agent      text,
  ip_hash         text,   -- sha256 do IP (não armazenar IP cru)
  -- Pipeline
  status          text not null default 'novo'
                  check (status in ('novo','contatado','qualificado','perdido','convertido')),
  contatado_em    timestamptz,
  notas_internas  text,
  -- Auditoria
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index if not exists leads_lp_criado_idx on public.leads_lp (criado_em desc);
create index if not exists leads_lp_tipo_idx   on public.leads_lp (tipo, status);
create index if not exists leads_lp_email_idx  on public.leads_lp (lower(email));
create index if not exists leads_lp_utm_idx    on public.leads_lp (utm_campaign);

-- Trigger pra manter atualizado_em
create or replace function public.touch_leads_lp() returns trigger as $$
begin new.atualizado_em = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_leads_lp on public.leads_lp;
create trigger trg_touch_leads_lp before update on public.leads_lp
  for each row execute function public.touch_leads_lp();

-- Permissões: leads_lp NÃO faz parte do escopo multi-tenant; é uma fila de
-- pré-vendas. Apenas admin/super lê (consultado via Admin); writes vêm da
-- API pública /api/lp-lead que usa a role admin (server-only).
grant insert on public.leads_lp to previa_app;
grant select on public.leads_lp to previa_app;
