-- ============================================================================
-- PrevIA · seed de desenvolvimento
--   * 1 clínica demo (webhook_secret = 'demo-secret-do-not-use-in-prod')
--   * histórico de eventos agregados anônimos p/ os dashboards terem dados reais
-- ============================================================================

-- Clínica demo (hash do segredo calculado pelo próprio Postgres)
insert into public.clinicas (id, nome, cnpj, webhook_secret_hash, ativa)
values (
  'clin_translog_demo',
  'Clínica Bem-Estar Translog',
  '12.345.678/0001-99',
  encode(digest('demo-secret-do-not-use-in-prod', 'sha256'), 'hex'),
  true
)
on conflict (id) do nothing;

-- Histórico sintético: ~60 atendimentos nos últimos 45 dias, distribuídos por
-- setor × turno, com ofensores coerentes. Determinístico (sem random) p/ reprodutibilidade.
do $$
declare
  setores text[]  := array['Logística','Atendimento (SAC)','Produção','Administrativo','Manutenção','Comercial'];
  turnos  text[]  := array['manha','tarde','noite','madrugada'];
  v_setor text;
  v_turno text;
  v_sev   text;
  v_evt   uuid;
  i int;
  carga int;        -- "intensidade" do cluster → severidade e ofensores
  d int;            -- dias atrás
begin
  for i in 1..60 loop
    v_setor := setores[1 + (i % array_length(setores,1))];
    v_turno := turnos[1 + ((i / 2) % array_length(turnos,1))];
    -- Logística noturna e SAC tarde concentram mais risco (coerente com a demo)
    carga := 1
      + (case when v_setor = 'Logística' and v_turno in ('noite','madrugada') then 3 else 0 end)
      + (case when v_setor = 'Atendimento (SAC)' and v_turno = 'tarde' then 2 else 0 end)
      + (i % 3);
    v_sev := case
      when carga >= 5 then 'critica'
      when carga = 4 then 'alta'
      when carga in (2,3) then 'media'
      else 'baixa' end;
    d := (i * 3) % 45;

    insert into public.eventos_agregados
      (clinica_id, session_id_anon, iniciada_em, duracao_minutos,
       cluster_setor, cluster_turno, cluster_site,
       severidade_estimada, protocolo_emergencia, versao_extractor)
    values
      ('clin_translog_demo',
       encode(digest('seed-' || i::text, 'sha256'), 'hex'),
       now() - (d || ' days')::interval - ((i % 8) || ' hours')::interval,
       25 + (i % 20),
       v_setor, v_turno,
       case when v_setor = 'Logística' then 'SP-03'
            when v_setor = 'Manutenção' then 'RJ-01' else null end,
       v_sev,
       (v_sev = 'critica' and i % 17 = 0),  -- raríssimos casos de protocolo
       'seed@1.0')
    returning id into v_evt;

    -- Ofensores conforme o perfil do cluster
    if v_setor = 'Logística' then
      insert into public.ofensores_evento (evento_id, tag, confidence, ocorrencias)
      values (v_evt,'sobrecarga_trabalho', 0.70 + (carga::numeric/20), 2 + (i%4)),
             (v_evt,'jornada_descanso_insuficiente', 0.60 + (carga::numeric/25), 1 + (i%3));
    elsif v_setor = 'Atendimento (SAC)' then
      insert into public.ofensores_evento (evento_id, tag, confidence, ocorrencias)
      values (v_evt,'conflito_lideranca', 0.65 + (carga::numeric/25), 1 + (i%3)),
             (v_evt,'ritmo_pressao_metas', 0.60, 1 + (i%2));
    elsif v_setor = 'Manutenção' then
      insert into public.ofensores_evento (evento_id, tag, confidence, ocorrencias)
      values (v_evt,'jornada_descanso_insuficiente', 0.62, 1 + (i%3));
    elsif v_setor = 'Comercial' then
      insert into public.ofensores_evento (evento_id, tag, confidence, ocorrencias)
      values (v_evt,'ritmo_pressao_metas', 0.58, 1 + (i%2));
    elsif v_setor = 'Produção' then
      insert into public.ofensores_evento (evento_id, tag, confidence, ocorrencias)
      values (v_evt,'monotonia_falta_autonomia', 0.55, 1 + (i%2));
    end if;
  end loop;
end $$;
