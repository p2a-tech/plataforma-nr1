-- Empresa-holding do grupo + usuário Diretoria (visão global). Senha: previa123
insert into public.empresas (id, nome, segmento)
values ('emp_grupo_gps', 'Grupo GPS', 'Holding / Multisserviços')
on conflict (id) do update set nome = excluded.nome, segmento = excluded.segmento;

insert into public.usuarios (email, senha_hash, clinica_id, nome, papel, empresa_id)
values ('diretoria@gps.com.br', crypt('previa123', gen_salt('bf', 10)), null, 'Diretoria GPS', 'diretoria', 'emp_grupo_gps')
on conflict (email) do update set papel = excluded.papel, empresa_id = excluded.empresa_id, nome = excluded.nome;
