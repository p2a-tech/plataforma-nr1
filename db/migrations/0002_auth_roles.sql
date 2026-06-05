-- 0002 · papéis de usuário: clinica_id opcional (sst/admin não têm clínica).
-- (Sem seed de usuários demo — usuários reais são criados pela área Admin.)
alter table public.usuarios alter column clinica_id drop not null;
