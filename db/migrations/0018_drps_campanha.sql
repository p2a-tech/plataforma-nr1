-- ============================================================================
-- 0018 · DRPS · Campanha (substitui token determinístico O(n))
-- ----------------------------------------------------------------------------
-- Onda 5 · Dev B · §8 do BACKLOG_OKEBAMBO (Comparativo histórico).
--
-- O modelo da Onda 4 derivava o token de campanha por HMAC sobre `empresa_id`
-- e resolvia em runtime via força bruta sobre `public.empresas` (O(n)). Isso:
--   1) Não escala (clínicas → centenas de empresas é OK; SaaS → milhares não).
--   2) Não suporta expiração nem rotação de token.
--   3) Não permite múltiplas campanhas por empresa (ex.: "Q1-2026" vs "Q2-2026"),
--      que é o pré-requisito do §8 (comparativo histórico ciclo a ciclo).
--
-- Esta migration:
--   1) Cria `drps_campanha` (id, empresa_id, instrumento_id, codigo, titulo,
--      token UNIQUE, ciclo, ativo, expira_em, criado_em).
--   2) Adiciona `drps_resposta.campanha_id` (FK opcional → drps_campanha).
--   3) Backfill: cria uma campanha "Backfill Onda 4" por empresa COM respostas
--      existentes e vincula essas respostas a ela.
--   4) RLS forced por empresa_id; GRANTs pra previa_app.
--
-- Observação importante: drps_resposta.campanha_id continua NULLABLE no schema
-- (para permitir o backfill em duas etapas e tolerar uma janela curta entre o
-- INSERT e o UPDATE de campanha_id em registros novos). A invariante "toda
-- resposta tem campanha" é mantida em lib/drps.ts.
-- ============================================================================

-- ── 1) Tabela drps_campanha ────────────────────────────────────────────────
create table if not exists public.drps_campanha (
  id              uuid primary key default gen_random_uuid(),
  -- ON DELETE CASCADE pra alinhar com testes legados (drps.test.ts /
  -- drps-importador.test.ts) que deletam apenas drps_resposta + empresas no
  -- teardown. Como `drps_resposta.empresa_id` é RESTRICT, isso só "cascateia"
  -- depois das respostas terem sido removidas — não há risco de perda
  -- inadvertida em produção (uma empresa com respostas DRPS NUNCA pode ser
  -- removida sem antes purgar as respostas, e nesse momento as campanhas
  -- também deveriam ir embora).
  empresa_id      text not null references public.empresas(id) on delete cascade,
  instrumento_id  uuid references public.drps_instrumento(id) on delete restrict,
  codigo          text not null,                  -- 'q1-2026', 'mar-2026', etc.
  titulo          text not null,                  -- "Campanha DRPS Q1 2026"
  token           text not null unique,           -- token público (≥ 16 bytes b64url)
  ciclo           text not null,                  -- identificador agregador
                                                  -- pra comparativo histórico (§8)
  ativo           boolean not null default true,
  expira_em       timestamptz,                    -- NULL = sem expiração
  criado_em       timestamptz not null default now(),
  constraint drps_campanha_codigo_uk unique (empresa_id, codigo)
);

comment on table public.drps_campanha is
  'Campanha DRPS — substitui o token determinístico da Onda 4 por lookup '
  'persistente, com expiração, múltiplos ciclos e comparativo histórico (§8).';
comment on column public.drps_campanha.ciclo is
  'Identificador do ciclo (ex.: "q1-2026", "2026-mar"). Usado por '
  'lib/drps-historico.ts para agregar série temporal por dimensão.';
comment on column public.drps_campanha.token is
  'Token público da campanha. ≥ 16 bytes b64url (alta entropia, não derivado '
  'de chave compartilhada). Único globalmente — lookup direto na tabela.';

create index if not exists drps_campanha_emp_idx
  on public.drps_campanha (empresa_id, ativo, expira_em);
create index if not exists drps_campanha_token_idx
  on public.drps_campanha (token);
create index if not exists drps_campanha_emp_ciclo_idx
  on public.drps_campanha (empresa_id, ciclo);

-- ── 2) drps_resposta.campanha_id ───────────────────────────────────────────
alter table public.drps_resposta
  add column if not exists campanha_id uuid
  references public.drps_campanha(id) on delete set null;

create index if not exists drps_resposta_emp_camp_idx
  on public.drps_resposta (empresa_id, campanha_id, respondido_em desc);

-- ── 3) RLS + GRANTs ────────────────────────────────────────────────────────
alter table public.drps_campanha enable row level security;
alter table public.drps_campanha force row level security;
drop policy if exists tenant_isolation on public.drps_campanha;
create policy tenant_isolation on public.drps_campanha
  for all to previa_app
  using (empresa_id = current_setting('app.empresa_id', true))
  with check (empresa_id = current_setting('app.empresa_id', true));

grant select, insert, update on public.drps_campanha to previa_app;

-- ── 4) Backfill — Onda 4 → Onda 5 ─────────────────────────────────────────
-- Para cada empresa com respostas DRPS órfãs (campanha_id IS NULL), cria uma
-- campanha "Backfill Onda 4" e vincula todas as respostas existentes a ela.
-- Idempotente: reroda sem efeito colateral (insere por código único).
do $$
declare
  v_inst_id  uuid;
  v_empresa  text;
  v_camp_id  uuid;
  v_token    text;
begin
  -- Resolve instrumento global okebambo_v1 (usado por padrão na Onda 4).
  select id into v_inst_id
    from public.drps_instrumento
   where empresa_id is null and codigo = 'okebambo_v1' and ativo = true
   limit 1;

  for v_empresa in
    select distinct empresa_id
      from public.drps_resposta
     where campanha_id is null
  loop
    -- Token único (≥ 22 chars b64url) — usa gen_random_bytes (pgcrypto) com
    -- fallback pra md5(random()::text) caso a extensão não esteja disponível.
    -- Em produção, pgcrypto já está habilitada (gen_random_uuid existe).
    begin
      v_token := replace(replace(replace(
        encode(gen_random_bytes(16), 'base64'),
        '+', '-'), '/', '_'), '=', '');
    exception when others then
      v_token := md5(random()::text || clock_timestamp()::text);
    end;

    insert into public.drps_campanha
      (empresa_id, instrumento_id, codigo, titulo, token, ciclo, ativo, expira_em)
    values
      (v_empresa, v_inst_id, 'backfill_onda4',
       'Backfill Onda 4', v_token, 'backfill-onda4', true, null)
    on conflict (empresa_id, codigo) do update
       set titulo = excluded.titulo
    returning id into v_camp_id;

    update public.drps_resposta
       set campanha_id = v_camp_id
     where empresa_id = v_empresa
       and campanha_id is null;
  end loop;
end$$;
