-- 0004 · LGPD: consentimento + retenção (espelha db/init/09_lgpd.sql).
-- DDL idempotente + seed on-conflict (seguro de re-aplicar em bancos já provisionados).

create table if not exists public.termos_consentimento (
  versao    text primary key,
  texto     text not null,
  vigente   boolean not null default false,
  criado_em timestamptz not null default now()
);

comment on table public.termos_consentimento is
  'Termos de consentimento LGPD versionados. O termo vigente é o referenciado no opt-in.';

insert into public.termos_consentimento (versao, texto, vigente) values
  ('v1',
   'Ao responder, você participa de forma voluntária e ANÔNIMA da escuta de '
   || 'bem-estar (NR-1). Não coletamos seu nome nem qualquer dado que te '
   || 'identifique: seu telefone é convertido em código irreversível (hash) e '
   || 'suas respostas são agregadas com as do seu grupo (setor/turno) — nunca '
   || 'exibidas individualmente. Você pode parar a qualquer momento e pedir a '
   || 'exclusão dos seus dados. Base legal: consentimento (art. 7º, I, LGPD).',
   true)
on conflict (versao) do nothing;

alter table public.pulso_sessoes add column if not exists consentido_em timestamptz;
alter table public.pulso_sessoes add column if not exists termo_versao  text;

create table if not exists public.consentimentos (
  id           uuid primary key default gen_random_uuid(),
  telefone_hash text,
  termo_versao text,
  concedido_em timestamptz not null default now(),
  canal        text
);

comment on table public.consentimentos is
  'Livro-razão durável de consentimentos (opt-in). telefone_hash é pseudônimo (hash sha256), sem PII.';

create index if not exists consentimentos_telefone_idx on public.consentimentos (telefone_hash);
create index if not exists consentimentos_data_idx     on public.consentimentos (concedido_em desc);
