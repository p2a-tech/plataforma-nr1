-- ============================================================================
-- 0017 · Catálogo de papéis profissionais (Onda 5 · Dev A · §11)
-- ----------------------------------------------------------------------------
-- Catálogo GLOBAL (sem tenant) de cargos clínicos e administrativos típicos
-- em clínicas/setores de saúde. Alimenta o autocomplete da Q2 (função/cargo)
-- do DRPS e qualquer outro form que precise normalizar "papel profissional".
--
-- Por design (Onda 5):
--   - Catálogo é estável (IDs slug snake_case).
--   - Sem RLS — todas as empresas leem o mesmo catálogo.
--   - GRANT SELECT pra previa_app (escrita só por migration/admin).
--
-- Extensibilidade futura (P2): permitir cargos próprios por empresa via
-- tabela `cargo_empresa` (cargo_id + empresa_id + nome customizado), OU via
-- campo `meta jsonb` nas próprias entidades de DRPS. Por enquanto a UI
-- mantém o fallback "Outro (texto livre)" sem tabela adicional.
-- ============================================================================

create table if not exists public.cargo_clinico (
  id                     text primary key,
  nome                   text not null,
  conselho_profissional  text,
  area                   text not null check (area in (
    'clinica', 'administrativa', 'operacional',
    'comercial', 'apoio', 'direcao'
  ))
);

comment on table public.cargo_clinico is
  'Catálogo global de cargos clínicos / administrativos para autocomplete '
  'do DRPS (Q2). Empresas podem usar texto livre via "Outro".';

comment on column public.cargo_clinico.conselho_profissional is
  'Sigla do conselho que regulamenta a profissão (CRP, CRM, COREN...). '
  'NULL para cargos sem conselho (ex.: atendente, gestora).';

comment on column public.cargo_clinico.area is
  'Área funcional do cargo dentro da clínica. Usado em filtros e relatórios.';

-- Sem RLS (catálogo global, leitura aberta).
alter table public.cargo_clinico disable row level security;

grant select on public.cargo_clinico to previa_app;

create index if not exists cargo_clinico_area_idx
  on public.cargo_clinico (area, nome);

-- ============================================================================
-- SEED · cargos clínicos típicos (idempotente)
-- ----------------------------------------------------------------------------
-- IDs em snake_case slug. Re-rodar a migration mantém o catálogo no estado
-- desta versão (ON CONFLICT DO UPDATE).
-- ============================================================================

insert into public.cargo_clinico (id, nome, conselho_profissional, area) values
  -- ── Clínica ──
  ('psicologia',           'Psicologia',            'CRP',     'clinica'),
  ('psicopedagogia',       'Psicopedagogia',        'ABPP',    'clinica'),
  ('fonoaudiologia',       'Fonoaudiologia',        'CRFa',    'clinica'),
  ('terapia_ocupacional',  'Terapia Ocupacional',   'CREFITO', 'clinica'),
  ('fisioterapia',         'Fisioterapia',          'CREFITO', 'clinica'),
  ('medicina',             'Medicina',              'CRM',     'clinica'),
  ('enfermagem',           'Enfermagem',            'COREN',   'clinica'),

  -- ── Administrativa ──
  ('atendente',            'Atendente',             null,      'administrativa'),
  ('financeiro',           'Financeiro',            null,      'administrativa'),

  -- ── Direção ──
  ('gestora',              'Gestora',               null,      'direcao'),
  ('coordenacao_tecnica',  'Coordenação Técnica',   null,      'direcao'),

  -- ── Comercial ──
  ('comercial',            'Comercial',             null,      'comercial'),

  -- ── Apoio ──
  ('artesao',              'Artesão',               null,      'apoio'),
  ('higienizacao',         'Higienização/Limpeza',  null,      'apoio'),
  ('manutencao',           'Manutenção',            null,      'apoio'),
  ('recepcao',             'Recepção',              null,      'apoio')
on conflict (id) do update set
  nome                  = excluded.nome,
  conselho_profissional = excluded.conselho_profissional,
  area                  = excluded.area;
