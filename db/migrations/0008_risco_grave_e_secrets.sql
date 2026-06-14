-- ============================================================================
-- 0008 · Protocolo de risco grave/iminente + hardening de secrets de clínica
-- ----------------------------------------------------------------------------
-- E8 · NR-1 exige protocolo claro para situações de risco grave e iminente
-- (ideação suicida, violência iminente, surto). A clínica parceira reporta o
-- evento (sem PII) e a empresa (SST) acompanha o encerramento.
--
-- Também adiciona coluna `secret_cifrado` em `clinicas` para guardar o webhook
-- secret encriptado em DB (AES-256-GCM com KEK em env) — fim do CLINIC_SECRETS_JSON
-- como única fonte de verdade. JSON continua como fallback durante a transição.
-- ============================================================================

-- ── eventos_risco_grave ────────────────────────────────────────────────────
create table if not exists public.eventos_risco_grave (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        text not null references public.empresas(id) on delete restrict,
  clinica_id        text references public.clinicas(id) on delete set null,
  -- Marcador anônimo do evento (ex: session_id_anon do atendimento que
  -- disparou o gatilho). Por design NÃO referencia paciente real.
  marcador_anonimo  text not null,
  tipo              text not null check (tipo in (
    'ideacao_suicida','violencia_iminente','surto_psiquico','outros'
  )),
  severidade        int  not null check (severidade between 1 and 5),
  status            text not null default 'aberto'
                    check (status in ('aberto','em_atendimento','encerrado')),
  escalonado_para   text,
  notas             text,
  criado_em         timestamptz not null default now(),
  acionado_em       timestamptz,
  encerrado_em      timestamptz
);

comment on table public.eventos_risco_grave is
  'Protocolo NR-1 de risco grave/iminente. Apenas marcador anônimo + tipo + status — nunca PII.';

-- Índice usado pela listagem (eventos abertos por empresa) e pelo resumo.
create index if not exists eventos_risco_grave_emp_status_idx
  on public.eventos_risco_grave (empresa_id, status, criado_em desc);

-- ── RLS (defesa em profundidade) ───────────────────────────────────────────
alter table public.eventos_risco_grave enable row level security;
alter table public.eventos_risco_grave force row level security;
drop policy if exists tenant_isolation on public.eventos_risco_grave;
create policy tenant_isolation on public.eventos_risco_grave
  for all to previa_app
  using (empresa_id = current_setting('app.empresa_id', true))
  with check (empresa_id = current_setting('app.empresa_id', true));

grant select, insert, update on public.eventos_risco_grave to previa_app;

-- ── Hardening de secrets de clínica ────────────────────────────────────────
-- Webhook secret cifrado (AES-256-GCM): payload binário = iv(12) || tag(16) || ciphertext.
-- A KEK (Key Encryption Key) vive em env (CLINIC_KEK). NUNCA logamos secret_cifrado.
alter table public.clinicas
  add column if not exists secret_cifrado bytea;

comment on column public.clinicas.secret_cifrado is
  'Webhook secret cifrado AES-256-GCM (iv || tag || ciphertext). KEK em env CLINIC_KEK. NULL = fallback ao CLINIC_SECRETS_JSON.';
