-- ============================================================================
-- PrevIA · papéis de usuário (sst / clinica / admin)
--   clinica_id passa a ser opcional (sst/admin não pertencem a clínica).
--   Seed de usuários demo (dev). Senha de todos: previa123
-- ============================================================================

alter table public.usuarios alter column clinica_id drop not null;

insert into public.usuarios (email, senha_hash, clinica_id, nome, papel) values
  ('gestor@translog.com.br', crypt('previa123', gen_salt('bf', 10)), null, 'Marina Alves', 'sst'),
  ('admin@p2a.tech',         crypt('previa123', gen_salt('bf', 10)), null, 'Admin P2A',     'admin')
on conflict (email) do nothing;
