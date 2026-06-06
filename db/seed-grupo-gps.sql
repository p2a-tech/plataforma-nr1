-- ============================================================================
-- PrevIA · seed do Grupo GPS (visão Diretoria) — escala real
-- 180.000 colaboradores distribuídos entre as 17 empresas do grupo
-- (maiores empregadoras: Rudder, In-Haus, TopService).
--   empresas.colaboradores = quadro de pessoal (alcance) por empresa
--   pulso_respostas        = respostas (adesão ~72-88% por empresa)
-- Idempotente: re-rodar atualiza o quadro e ressemeia as respostas do grupo.
-- ============================================================================

-- coluna de quadro de pessoal (alcance do grupo; pulso_alvos é single-tenant)
alter table public.empresas add column if not exists colaboradores int;

-- 1) Empresas do grupo + segmento + colaboradores (soma = 180.000)
insert into public.empresas (id, nome, segmento, colaboradores) values
  ('emp_rudder',    'Rudder',                      'Tecnologia & Engenharia',     26000),
  ('emp_inhaus',    'In-Haus',                     'Limpeza & Conservação',       24000),
  ('emp_topservice','TOPservice',                  'Limpeza & Conservação',       22000),
  ('emp_allis',     'Allis',                       'RH & Trabalho Temporário',    14000),
  ('emp_conbras',   'Conbras',                     'Facilities & Serviços',       13000),
  ('emp_engie',     'Engie Serviços e Facilities', 'Facilities & Serviços',       12000),
  ('emp_vivante',   'Vivante',                     'Facilities & Serviços',       11000),
  ('emp_global',    'Global',                      'Facilities & Serviços',       10000),
  ('emp_luandre',   'Luandre',                     'RH & Trabalho Temporário',     9000),
  ('emp_graber',    'Graber',                      'Facilities & Serviços',        8000),
  ('emp_trademark', 'Grupo Trademark',             'Facilities & Serviços',        7000),
  ('emp_ecopolo',   'Ecopolo',                     'Limpeza & Conservação',        6000),
  ('emp_compart',   'Compart',                     'Facilities & Serviços',        5500),
  ('emp_predial',   'Predial',                     'Facilities & Serviços',        4500),
  ('emp_campseg',   'Campseg',                     'Segurança Patrimonial',        3500),
  ('emp_tlsv',      'TLSV',                        'Segurança Patrimonial',        2500),
  ('emp_gpstec',    'GPStec',                      'Tecnologia & Engenharia',      2000)
on conflict (id) do update
  set nome = excluded.nome, segmento = excluded.segmento, colaboradores = excluded.colaboradores;

-- 2) Limpa respostas anteriores das empresas do grupo
delete from public.pulso_respostas where empresa_id in (
  'emp_graber','emp_predial','emp_inhaus','emp_ecopolo','emp_luandre','emp_allis',
  'emp_vivante','emp_conbras','emp_tlsv','emp_compart','emp_rudder','emp_global',
  'emp_campseg','emp_trademark','emp_engie','emp_gpstec','emp_topservice');

-- 3) pulso_respostas: adesão ~72-88% por empresa (hash determinístico),
--    energia centrada por empresa (risco heterogêneo), datas nas últimas ~20h.
--    SETORES por SEGMENTO (cada segmento tem 4 específicos + 'Administrativo'
--    genérico, compartilhado — no consolidado aparece uma única vez via group by).
with plano as (
  select e.id, e.segmento,
         (2 + (abs(hashtext(e.id)) % 3))                                          as centro,
         floor(e.colaboradores * (0.72 + (abs(hashtext(e.id)) % 17) / 100.0))::int as n_resp
  from public.empresas e
  where e.colaboradores is not null
    and e.id <> 'emp_grupo_gps'
)
insert into public.pulso_respostas
  (empresa_id, cluster_setor, cluster_turno, cluster_site, canal, energia, ofensor, duracao_seg, respondido_em)
select
  pl.id,
  case pl.segmento
    when 'Facilities & Serviços'       then (array['Manutenção Predial','Portaria','Recepção','Jardinagem','Administrativo'])[1 + floor(random()*5)]
    when 'Limpeza & Conservação'       then (array['Limpeza & Conservação','Áreas Comuns','Sanitização','Coleta de Resíduos','Administrativo'])[1 + floor(random()*5)]
    when 'Segurança Patrimonial'       then (array['Vigilância','Ronda','Monitoramento (CFTV)','Controle de Acesso','Administrativo'])[1 + floor(random()*5)]
    when 'RH & Trabalho Temporário'    then (array['Recrutamento & Seleção','Alocação','Departamento Pessoal','Atendimento (SAC)','Administrativo'])[1 + floor(random()*5)]
    when 'Tecnologia & Engenharia'     then (array['Desenvolvimento','Service Desk','Infraestrutura','Projetos & Engenharia','Administrativo'])[1 + floor(random()*5)]
    else (array['Operações','Administrativo'])[1 + floor(random()*2)]
  end,
  (array['manha','tarde','noite','madrugada'])[1 + floor(random()*4)],
  null,
  (array['whatsapp','whatsapp','whatsapp','app','totem'])[1 + floor(random()*5)],
  greatest(1, least(5, pl.centro + (floor(random()*3)::int - 1))),
  (array['sobrecarga_trabalho','ritmo_pressao_metas','conflito_lideranca','jornada_descanso_insuficiente','falta_reconhecimento',null])[1 + floor(random()*6)],
  20 + floor(random()*30)::int,
  now() - (random() * interval '20 hours')
from plano pl
cross join lateral generate_series(1, pl.n_resp) g;
