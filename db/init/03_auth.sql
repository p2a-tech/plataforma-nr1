-- ============================================================================
-- PrevIA · usuários de clínica (auth)
-- Senhas em bcrypt (pgcrypto bf). bcryptjs no app verifica hashes $2a$.
-- ============================================================================

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

-- Usuário demo da clínica (senha: previa123)
insert into public.usuarios (email, senha_hash, clinica_id, nome, papel)
values (
  'clinica@translog.com.br',
  crypt('previa123', gen_salt('bf', 10)),
  'clin_translog_demo',
  'Dr. Rafael Nunes',
  'clinica'
)
on conflict (email) do nothing;
