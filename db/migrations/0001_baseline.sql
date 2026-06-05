-- ============================================================================
-- PrevIA · migration baseline (0001)
-- ----------------------------------------------------------------------------
-- Consolida o schema atual (espelho idempotente de db/init/01,03,04,05).
-- NÃO inclui seed/demo (db/init/02_seed.sql e 06_radar_seed.sql) — produção
-- recebe dados reais via app/webhooks. Tudo aqui é `if not exists` /
-- `on conflict do nothing`, então rodar de novo é seguro.
--
-- Barreira de sigilo (@previa/contracts): nenhuma coluna guarda transcript,
-- PII de paciente, diagnóstico, etc. Só agregados/anônimos atravessam.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Clínicas parceiras (multitenancy)
-- ---------------------------------------------------------------------------
create table if not exists public.clinicas (
  id                  text primary key,
  nome                text not null,
  cnpj                text,
  webhook_secret_hash text not null,           -- sha256 do segredo (nunca o cru)
  ativa               boolean not null default true,
  criada_em           timestamptz not null default now()
);
comment on column public.clinicas.webhook_secret_hash is
  'sha256 hex do webhook secret. O segredo cru vive só no perímetro da clínica (env/secret manager).';

-- ---------------------------------------------------------------------------
-- Eventos agregados (saída da barreira — fonte de verdade dos dashboards)
-- ---------------------------------------------------------------------------
create table if not exists public.eventos_agregados (
  id                   uuid primary key default gen_random_uuid(),
  clinica_id           text not null references public.clinicas(id) on delete restrict,
  session_id_anon      text not null,
  iniciada_em          timestamptz not null,
  duracao_minutos      int  not null check (duracao_minutos between 1 and 240),
  cluster_setor        text not null,
  cluster_turno        text not null check (cluster_turno in ('manha','tarde','noite','madrugada')),
  cluster_site         text,
  severidade_estimada  text not null check (severidade_estimada in ('baixa','media','alta','critica')),
  protocolo_emergencia boolean not null default false,
  versao_extractor     text not null,
  criado_em            timestamptz not null default now(),
  -- Idempotência: a clínica pode reenviar o mesmo session_id_anon sem duplicar.
  constraint eventos_agregados_idem_uk unique (clinica_id, session_id_anon)
);
comment on table public.eventos_agregados is
  'Pacote agregado que atravessa a barreira clínica->PrevIA. NUNCA contém PII/transcript.';

create index if not exists eventos_agregados_clinica_iniciada_idx
  on public.eventos_agregados (clinica_id, iniciada_em desc);
create index if not exists eventos_agregados_heatmap_idx
  on public.eventos_agregados (clinica_id, cluster_setor, cluster_turno);

-- ---------------------------------------------------------------------------
-- Ofensores organizacionais (taxonomia canônica NR-1) extraídos pela IA local
-- ---------------------------------------------------------------------------
create table if not exists public.ofensores_evento (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid not null references public.eventos_agregados(id) on delete cascade,
  tag          text not null check (tag in (
    'sobrecarga_trabalho','ritmo_pressao_metas','conflito_lideranca',
    'jornada_descanso_insuficiente','falta_reconhecimento','inseguranca_emprego',
    'assedio_moral','monotonia_falta_autonomia','isolamento_apoio_social',
    'ambiguidade_de_papel','violencia_terceiros'
  )),
  confidence   numeric(4,3) not null check (confidence between 0 and 1),
  ocorrencias  int check (ocorrencias is null or ocorrencias between 1 and 50)
);

create index if not exists ofensores_evento_tag_idx    on public.ofensores_evento (tag);
create index if not exists ofensores_evento_evento_idx on public.ofensores_evento (evento_id);

-- ---------------------------------------------------------------------------
-- Audit log do webhook — por design NÃO armazena o payload, só metadados.
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_audit_log (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         text references public.clinicas(id),
  resultado          text not null check (resultado in ('aceito','rejeitado')),
  motivo             text,
  assinatura_valida  boolean not null,
  ip_origem          text,
  payload_size_bytes int,
  latency_ms         int,
  recebido_em        timestamptz not null default now()
);
comment on table public.webhook_audit_log is
  'Trilha de auditoria do webhook. Por design NÃO armazena o payload — só metadados.';

create index if not exists webhook_audit_log_clinica_recebido_idx
  on public.webhook_audit_log (clinica_id, recebido_em desc);

-- ---------------------------------------------------------------------------
-- Usuários de clínica (auth). Senhas em bcrypt; app verifica com bcryptjs.
-- (Sem seed de usuário demo — criar usuários reais em produção.)
-- ---------------------------------------------------------------------------
create table if not exists public.usuarios (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  senha_hash  text not null,
  clinica_id  text not null references public.clinicas(id) on delete cascade,
  nome        text,
  papel       text not null default 'clinica',
  criado_em   timestamptz not null default now()
);

create index if not exists usuarios_clinica_idx on public.usuarios (clinica_id);

-- ---------------------------------------------------------------------------
-- Assinaturas digitais do PGR (decisão humana assinada — NR-1)
-- ---------------------------------------------------------------------------
create table if not exists public.pgr_assinaturas (
  id                  uuid primary key default gen_random_uuid(),
  empresa_cnpj        text not null,
  revisao             int  not null,
  conteudo_hash       text not null,
  resumo              jsonb not null,
  assinante_nome      text not null,
  assinante_papel     text not null,
  assinante_registro  text,
  selo                text not null,
  assinado_em         timestamptz not null default now()
);

create index if not exists pgr_assinaturas_empresa_idx
  on public.pgr_assinaturas (empresa_cnpj, assinado_em desc);

-- ---------------------------------------------------------------------------
-- Radar (escuta ativa por micro-pulsos) — respostas anônimas + alvos por cluster
-- ---------------------------------------------------------------------------
create table if not exists public.pulso_alvos (
  cluster_setor text not null,
  cluster_turno text not null check (cluster_turno in ('manha','tarde','noite','madrugada')),
  convidados    int  not null check (convidados >= 0),
  primary key (cluster_setor, cluster_turno)
);

create table if not exists public.pulso_respostas (
  id            uuid primary key default gen_random_uuid(),
  cluster_setor text not null,
  cluster_turno text not null check (cluster_turno in ('manha','tarde','noite','madrugada')),
  cluster_site  text,
  canal         text not null default 'whatsapp' check (canal in ('whatsapp','app','totem')),
  energia       int  not null check (energia between 1 and 5),
  ofensor       text check (ofensor in (
    'sobrecarga_trabalho','ritmo_pressao_metas','conflito_lideranca',
    'jornada_descanso_insuficiente','falta_reconhecimento','inseguranca_emprego',
    'assedio_moral','monotonia_falta_autonomia','isolamento_apoio_social',
    'ambiguidade_de_papel','violencia_terceiros'
  )),
  duracao_seg   int,
  respondido_em timestamptz not null default now()
);
comment on table public.pulso_respostas is
  'Respostas anônimas aos micro-pulsos. Nunca exibidas individualmente (k-anonymity na leitura).';

create index if not exists pulso_respostas_cluster_idx on public.pulso_respostas (cluster_setor, cluster_turno);
create index if not exists pulso_respostas_data_idx    on public.pulso_respostas (respondido_em desc);

-- Estado de conversa do WhatsApp (fluxo do bot). Sem PII: telefone é hash.
create table if not exists public.pulso_sessoes (
  telefone_hash text primary key,
  cluster_setor text,
  cluster_turno text,
  etapa         text not null default 'inicio',
  energia       int,
  atualizado_em timestamptz not null default now()
);
