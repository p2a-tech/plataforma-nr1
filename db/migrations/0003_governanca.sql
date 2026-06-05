-- 0003 · Governança & LGPD: config persistida (espelha db/init/08_governanca.sql).
-- DDL idempotente + seed on-conflict (seguro de re-aplicar em bancos já provisionados).

create table if not exists public.config_governanca (
  id            text primary key,
  titulo        text not null,
  descricao     text not null,
  ativo         boolean not null default true,
  critico       boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

comment on table public.config_governanca is
  'Controles de privacidade & conformidade (LGPD/NR-1). Estado real; edição sst|admin.';

insert into public.config_governanca (id, titulo, descricao, ativo, critico) values
  ('k-anon',     'Anonimização (k-anonymity)',
                 'Só exibe clusters com tamanho mínimo (k≥7). Nunca respostas individuais.',
                 true,  true),
  ('consent',    'Consentimento explícito',
                 'Trabalhador consente antes de qualquer pulso ou encaminhamento.',
                 true,  true),
  ('sigilo',     'Barreira de sigilo clínico',
                 'A plataforma nunca acessa conteúdo das sessões. Inviolável.',
                 true,  true),
  ('api',        'Integração via API/Webhook com a clínica',
                 'Troca apenas dados agregados e anônimos (ofensores genéricos).',
                 true,  false),
  ('retencao',   'Política de retenção de dados',
                 'Dados de pulsos retidos por 12 meses e então anonimizados em definitivo.',
                 true,  false),
  ('risco-grave','Protocolo de risco grave/iminente',
                 'Aciona fluxo humano de emergência imediatamente. Exceção ao anonimato.',
                 true,  true)
on conflict (id) do nothing;
