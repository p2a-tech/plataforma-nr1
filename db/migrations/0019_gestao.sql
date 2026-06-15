-- ============================================================================
-- 0019 · Gestão de empresas & usuários (Onda 6 · Dev A)
-- ----------------------------------------------------------------------------
-- Suporte ao onboarding de clientes pelo Console Admin (/admin):
--   - `usuarios.ativo`     → permite suspender acesso sem apagar o registro.
--   - `usuarios.criado_por`→ trilha de quem (e-mail do admin) criou o usuário.
--   - índice (empresa_id, papel) para a listagem filtrada de usuários.
--
-- Idempotente: tudo com IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================================

alter table public.usuarios
  add column if not exists ativo boolean not null default true;

alter table public.usuarios
  add column if not exists criado_por text; -- e-mail do admin que criou (trilha)

comment on column public.usuarios.ativo is
  'false suspende o acesso do usuário sem apagar o registro (login deve recusar).';
comment on column public.usuarios.criado_por is
  'E-mail do admin que criou o usuário via Console Admin (trilha de onboarding).';

create index if not exists usuarios_empresa_papel_idx
  on public.usuarios (empresa_id, papel);
