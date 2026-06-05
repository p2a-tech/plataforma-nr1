-- ============================================================================
-- PrevIA · seed do Radar — respostas anônimas sintéticas (determinístico)
--   Distribui ~360 respostas por cluster/turno/canal nos últimos 10 dias.
--   Deixa 2 clusters com <7 respostas DE PROPÓSITO, para demonstrar a
--   supressão por k-anonymity na leitura.
-- ============================================================================

do $$
declare
  setores text[]   := array['Logística','Atendimento (SAC)','Produção','Administrativo','Manutenção','Comercial'];
  turnos  text[]   := array['manha','tarde','noite','madrugada'];
  ofensores text[] := array[
    'sobrecarga_trabalho','ritmo_pressao_metas','conflito_lideranca',
    'jornada_descanso_insuficiente','falta_reconhecimento', null];
  st text; tn text;
  base_en int; en int; resp int; conv int; k int; d int; can text; ofs text;
begin
  foreach st in array setores loop
    foreach tn in array turnos loop
      -- energia base por perfil de cluster (menor energia = maior risco)
      base_en := 4;
      if st = 'Logística' and tn in ('noite','madrugada') then base_en := 2; end if;
      if st = 'Atendimento (SAC)' and tn = 'tarde' then base_en := 2; end if;
      if st = 'Manutenção' and tn = 'madrugada' then base_en := 3; end if;
      if st = 'Produção' and tn = 'noite' then base_en := 3; end if;

      -- nº de respostas (2 clusters propositalmente pequenos p/ k-anonymity)
      resp := 12 + (length(st) % 7);
      if st = 'Comercial' and tn = 'madrugada' then resp := 3; end if;
      if st = 'Administrativo' and tn = 'madrugada' then resp := 4; end if;

      conv := ceil(resp / 0.72);
      insert into public.pulso_alvos (cluster_setor, cluster_turno, convidados)
        values (st, tn, conv)
        on conflict (cluster_setor, cluster_turno) do nothing;

      for k in 1..resp loop
        en  := greatest(1, least(5, base_en + ((k % 3) - 1)));
        d   := (k * 7) % 10;
        can := case when k % 9 = 0 then 'totem' when k % 5 = 0 then 'app' else 'whatsapp' end;
        ofs := ofensores[1 + (k % array_length(ofensores, 1))];
        insert into public.pulso_respostas
          (cluster_setor, cluster_turno, cluster_site, canal, energia, ofensor, duracao_seg, respondido_em)
        values
          (st, tn,
           case when st = 'Logística' then 'SP-03' when st = 'Manutenção' then 'RJ-01' else null end,
           can, en, ofs, 25 + (k % 20),
           now() - (d || ' days')::interval - ((k % 12) || ' hours')::interval);
      end loop;
    end loop;
  end loop;
end $$;
