-- ============================================================================
-- 0015 · PGR Okêbambo — campos completos para PGR no formato real Okêbambo
--
-- Material de referência: Word "Modelo PGR" + caso real "PGR Okêbambo"
-- (Clínica Okêbambo Saúde e Educação · CNPJ 54.413.743/0001-12).
--
-- Onda 4 / Dev C · Backlog §6 — 9 seções obrigatórias do PGR.
--
-- Este script:
--   1. Cria a tabela `pgr_revisao` (se não existir) — rascunho de uma revisão
--      do PGR antes da assinatura. Distinta de `pgr_assinaturas` (que já
--      existe em 0001) porque pgr_assinaturas guarda assinaturas IMUTÁVEIS
--      pós-assinatura, e aqui precisamos de campos EDITÁVEIS antes.
--   2. Adiciona as colunas Okêbambo (responsável técnico, identificação da
--      empresa, atividades, riscos físicos e ergonômicos manuais).
--   3. Habilita RLS + política tenant_isolation (igual aos demais).
--
-- Todas as ALTERs são idempotentes via IF NOT EXISTS individual por coluna.
-- ============================================================================

-- 1) Tabela base (rascunho da revisão do PGR)
create table if not exists public.pgr_revisao (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    text not null references public.empresas(id) on delete restrict,
  revisao       int  not null,
  status        text not null default 'rascunho' check (status in ('rascunho','pronto_para_assinar','assinada','arquivada')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists pgr_revisao_emp_rev_idx
  on public.pgr_revisao (empresa_id, revisao);

create index if not exists pgr_revisao_emp_status_idx
  on public.pgr_revisao (empresa_id, status, atualizado_em desc);

-- 2) Identificação da empresa (Seção 1 do PGR Okêbambo)
alter table public.pgr_revisao add column if not exists cnpj text;
comment on column public.pgr_revisao.cnpj is
  'Okêbambo §1 · CNPJ formatado 00.000.000/0000-00. Vem do material real.';

alter table public.pgr_revisao add column if not exists razao_social text;
comment on column public.pgr_revisao.razao_social is
  'Okêbambo §1 · Razão social conforme contrato social (ex.: "Okêbambo Saúde e Educação LTDA").';

alter table public.pgr_revisao add column if not exists nome_fantasia text;
comment on column public.pgr_revisao.nome_fantasia is
  'Okêbambo §1 · Nome fantasia / nome de marca da clínica (ex.: "Okêbambo").';

alter table public.pgr_revisao add column if not exists endereco text;
comment on column public.pgr_revisao.endereco is
  'Okêbambo §1 · Endereço completo da sede da clínica (rua, número, bairro, cidade, UF, CEP).';

-- 3) Responsável técnico (Seção 1 + 9 do PGR Okêbambo)
alter table public.pgr_revisao add column if not exists responsavel_tecnico_nome text;
comment on column public.pgr_revisao.responsavel_tecnico_nome is
  'Okêbambo §1+§9 · Nome do responsável técnico (Eng. de Segurança, psicólogo do trabalho, etc.).';

alter table public.pgr_revisao add column if not exists responsavel_tecnico_registro text;
comment on column public.pgr_revisao.responsavel_tecnico_registro is
  'Okêbambo §1+§9 · Número do registro profissional do responsável (ex.: "12345").';

alter table public.pgr_revisao add column if not exists responsavel_tecnico_conselho text;
comment on column public.pgr_revisao.responsavel_tecnico_conselho is
  'Okêbambo §1+§9 · Sigla do conselho de classe (CRP / CRM / CREA / COREN / etc.).';

-- 4) Caracterização das atividades (Seção 3 do PGR Okêbambo)
alter table public.pgr_revisao add column if not exists publico_atendido text;
comment on column public.pgr_revisao.publico_atendido is
  'Okêbambo §3 · Público atendido pela clínica (ex.: crianças, adolescentes, adultos, famílias).';

alter table public.pgr_revisao add column if not exists descricao_atividades text;
comment on column public.pgr_revisao.descricao_atividades is
  'Okêbambo §3 · Descrição operacional das atividades clínicas (atendimentos, avaliações, supervisão etc.).';

-- 5) Riscos manuais (Seção 4.1 e 4.2 — físicos e ergonômicos)
-- Cada item do array tem o formato:
--   { "risco": "...", "fonte": "...", "consequencia": "..." }
alter table public.pgr_revisao add column if not exists riscos_fisicos jsonb not null default '[]'::jsonb;
comment on column public.pgr_revisao.riscos_fisicos is
  'Okêbambo §4.1 · Riscos físicos manuais (array de {risco, fonte, consequencia}). Ex.: ruído, iluminação, temperatura.';

alter table public.pgr_revisao add column if not exists riscos_ergonomicos jsonb not null default '[]'::jsonb;
comment on column public.pgr_revisao.riscos_ergonomicos is
  'Okêbambo §4.2 · Riscos ergonômicos manuais (array de {risco, fonte, consequencia}). Ex.: postura, permanência prolongada sentado.';

-- 6) RLS + política (igual ao resto da plataforma)
alter table public.pgr_revisao enable row level security;
alter table public.pgr_revisao force row level security;
drop policy if exists tenant_isolation on public.pgr_revisao;
create policy tenant_isolation on public.pgr_revisao
  for all to previa_app
  using (empresa_id = public.empresa_escopo())
  with check (empresa_id = public.empresa_escopo());

-- Grants para previa_app (defaults da migration 0006 já cobrem, mas reafirmar)
grant select, insert, update, delete on public.pgr_revisao to previa_app;

-- Trigger simples para atualizar atualizado_em em cada UPDATE
create or replace function public.pgr_revisao_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists pgr_revisao_touch on public.pgr_revisao;
create trigger pgr_revisao_touch
  before update on public.pgr_revisao
  for each row execute function public.pgr_revisao_touch();
