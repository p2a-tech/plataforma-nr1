-- ============================================================================
-- 0013 · DRPS · Respostas (anônimas)
-- ----------------------------------------------------------------------------
-- Captura uma resposta completa do questionário DRPS por colaborador anônimo.
-- ZERO PII: sem email/CPF/telefone — apenas marcador opaco para idempotência
-- e analytics agregada. RLS por empresa_id (multi-tenant strict).
-- ============================================================================

-- ── Resposta (1 por colaborador anônimo) ───────────────────────────────────
create table if not exists public.drps_resposta (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        text not null references public.empresas(id) on delete restrict,
  instrumento_id    uuid not null references public.drps_instrumento(id) on delete restrict,
  -- Marcador opaco do colaborador (hash/uuid gerado pelo cliente, sem PII).
  -- Permite idempotência (re-envio do mesmo token de campanha não duplica
  -- a métrica do colaborador). NÃO é PK porque o mesmo profissional pode
  -- responder ciclos diferentes — combinamos com instrumento_id no índice.
  marcador_anonimo  text not null,
  -- Demografia (desnormalizada pra agilidade de filtros em /escuta/drps)
  setor             text,
  funcao            text,
  tempo_empresa     text,
  forma_atuacao     text,
  canal             text not null default 'web' check (canal in ('web','whatsapp','app','totem')),
  respondido_em     timestamptz not null default now(),
  -- Idempotência: mesmo marcador + mesmo instrumento = mesma resposta.
  constraint drps_resposta_uk unique (instrumento_id, marcador_anonimo)
);

comment on table public.drps_resposta is
  'Resposta DRPS anônima — sem PII identificável. Marcador é hash opaco.';

create index if not exists drps_resposta_emp_data_idx
  on public.drps_resposta (empresa_id, respondido_em desc);
create index if not exists drps_resposta_emp_inst_idx
  on public.drps_resposta (empresa_id, instrumento_id);

-- ── Itens (1 por pergunta respondida) ──────────────────────────────────────
create table if not exists public.drps_resposta_item (
  id           bigserial primary key,
  resposta_id  uuid not null references public.drps_resposta(id) on delete cascade,
  pergunta_id  uuid not null references public.drps_pergunta(id)  on delete restrict,
  valor_int    int,                      -- Likert/impacto/esgotamento
  valor_texto  text,                     -- demografia livre / texto aberto
  constraint drps_resposta_item_uk unique (resposta_id, pergunta_id)
);

create index if not exists drps_resposta_item_resp_idx
  on public.drps_resposta_item (resposta_id);
create index if not exists drps_resposta_item_pergunta_idx
  on public.drps_resposta_item (pergunta_id);

-- ── Opções selecionadas (multi-choice) ─────────────────────────────────────
create table if not exists public.drps_resposta_opcao (
  resposta_id  uuid not null references public.drps_resposta(id) on delete cascade,
  opcao_id     uuid not null references public.drps_opcao(id)     on delete restrict,
  primary key (resposta_id, opcao_id)
);

create index if not exists drps_resposta_opcao_opcao_idx
  on public.drps_resposta_opcao (opcao_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.drps_resposta enable row level security;
alter table public.drps_resposta force row level security;
drop policy if exists tenant_isolation on public.drps_resposta;
create policy tenant_isolation on public.drps_resposta
  for all to previa_app
  using (empresa_id = current_setting('app.empresa_id', true))
  with check (empresa_id = current_setting('app.empresa_id', true));

alter table public.drps_resposta_item enable row level security;
alter table public.drps_resposta_item force row level security;
drop policy if exists tenant_isolation on public.drps_resposta_item;
create policy tenant_isolation on public.drps_resposta_item
  for all to previa_app
  using (
    exists (select 1 from public.drps_resposta r
             where r.id = drps_resposta_item.resposta_id
               and r.empresa_id = current_setting('app.empresa_id', true))
  )
  with check (
    exists (select 1 from public.drps_resposta r
             where r.id = drps_resposta_item.resposta_id
               and r.empresa_id = current_setting('app.empresa_id', true))
  );

alter table public.drps_resposta_opcao enable row level security;
alter table public.drps_resposta_opcao force row level security;
drop policy if exists tenant_isolation on public.drps_resposta_opcao;
create policy tenant_isolation on public.drps_resposta_opcao
  for all to previa_app
  using (
    exists (select 1 from public.drps_resposta r
             where r.id = drps_resposta_opcao.resposta_id
               and r.empresa_id = current_setting('app.empresa_id', true))
  )
  with check (
    exists (select 1 from public.drps_resposta r
             where r.id = drps_resposta_opcao.resposta_id
               and r.empresa_id = current_setting('app.empresa_id', true))
  );

grant select, insert, update, delete on public.drps_resposta       to previa_app;
grant select, insert, update, delete on public.drps_resposta_item  to previa_app;
grant select, insert, update, delete on public.drps_resposta_opcao to previa_app;
grant usage, select on sequence public.drps_resposta_item_id_seq to previa_app;
