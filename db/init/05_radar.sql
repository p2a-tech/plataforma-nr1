-- ============================================================================
-- PrevIA · Radar (escuta ativa por micro-pulsos)
--   * pulso_respostas: respostas ANÔNIMAS (sem PII, sem id de pessoa).
--   * pulso_alvos: convidados por cluster (agregado) → permite calcular adesão.
--   k-anonymity (k≥7) é aplicada na LEITURA (clusters menores são suprimidos).
--   energia: 1 (no limite) … 5 (ótima). risco = (5-energia)/4.
-- ============================================================================

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

-- Estado de conversa do WhatsApp (para o fluxo do bot). Sem PII: telefone é hash.
create table if not exists public.pulso_sessoes (
  telefone_hash text primary key,
  cluster_setor text,
  cluster_turno text,
  etapa         text not null default 'inicio',
  energia       int,
  atualizado_em timestamptz not null default now()
);
