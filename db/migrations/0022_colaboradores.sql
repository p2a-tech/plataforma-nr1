-- ============================================================================
-- 0022 · Registro de colaboradores (quadro de RH) — eSocial S-2240 por CPF
-- ----------------------------------------------------------------------------
-- DECISÃO DE PRIVACIDADE (siga à risca):
--   O eSocial S-2240 (evtExpRisco) de PRODUÇÃO exige UM evento por trabalhador
--   (CPF). A PrevIA é ANÔNIMA no DRPS (respostas sem PII, k-anonimato ≥ 7).
--
--   Para gerar o S-2240 real sem quebrar o anonimato, a empresa cadastra aqui
--   o QUADRO de colaboradores (CPF, nome, matrícula, setor, cargo) numa tabela
--   DEDICADA — dado de RH do EMPREGADOR, totalmente SEPARADA das respostas
--   anônimas (`drps_resposta*`). O risco é mapeado POR SETOR (perfil de risco
--   do inventário DRPS) e cada CPF do setor recebe esse perfil agregado.
--
--   Isso NÃO liga ninguém a respostas individuais: não há FK, join nem chave
--   comum entre `colaborador_registro` e `drps_resposta`. A barreira de
--   anonimato permanece intacta. O CPF é PII do empregador (responsabilidade
--   dele declarar no eSocial), isolado por RLS, usado SÓ para o S-2240.
--
-- Idempotente. RLS FORCED por empresa_id. GRANT para previa_app.
-- ============================================================================

create table if not exists public.colaborador_registro (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  text not null references public.empresas(id) on delete restrict,
  -- CPF normalizado (só dígitos, 11 chars). PII do empregador — isolado por RLS.
  cpf         text not null,
  nome        text,
  matricula   text,
  -- Setor: chave de mapeamento para o perfil de risco do inventário DRPS.
  setor       text not null,
  cargo       text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz,
  constraint colaborador_registro_cpf_uk unique (empresa_id, cpf)
);

comment on table public.colaborador_registro is
  'Quadro de colaboradores (RH do empregador) para fan-out do eSocial S-2240 por CPF. '
  'NÃO é resposta DRPS: nenhuma relação/chave com drps_resposta (anônima). '
  'Isolado por RLS por empresa_id. CPF é PII do empregador — nunca cruza com respostas anônimas. '
  'Usado exclusivamente para gerar evtExpRisco por trabalhador (risco por setor aplicado ao CPF).';

comment on column public.colaborador_registro.cpf is
  'CPF normalizado (só dígitos, 11 chars). PII do empregador, RLS-isolado, uso restrito ao S-2240.';
comment on column public.colaborador_registro.setor is
  'Setor do colaborador — chave de mapeamento para o perfil de risco do setor (inventário DRPS).';

create index if not exists colaborador_registro_emp_setor_idx
  on public.colaborador_registro (empresa_id, setor);

-- ── RLS forced por empresa_id ───────────────────────────────────────────────
alter table public.colaborador_registro enable row level security;
alter table public.colaborador_registro force row level security;
drop policy if exists tenant_isolation on public.colaborador_registro;
create policy tenant_isolation on public.colaborador_registro
  for all to previa_app
  using (empresa_id = current_setting('app.empresa_id', true))
  with check (empresa_id = current_setting('app.empresa_id', true));

grant select, insert, update, delete on public.colaborador_registro to previa_app;
