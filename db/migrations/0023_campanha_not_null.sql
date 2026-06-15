-- ============================================================================
-- 0023 · DRPS · drps_resposta.campanha_id NOT NULL (Onda 7 · Dev B · Refinos F)
-- ----------------------------------------------------------------------------
-- A 0018 deixou `drps_resposta.campanha_id` NULLABLE de propósito (backfill em
-- duas etapas + janela curta entre INSERT e UPDATE). A invariante "toda
-- resposta tem campanha" era mantida apenas em código (lib/drps.ts). Agora que
-- `registrarResposta` SEMPRE resolve uma campanha (ativa mais recente, ou cria
-- 'avulso' como fallback), promovemos a invariante ao schema (NOT NULL) — assim
-- o §8 (comparativo histórico) nunca tropeça em respostas órfãs.
--
-- Estratégia (idempotente, segura pra rodar várias vezes):
--   1) Backfill: para cada empresa com respostas órfãs (campanha_id IS NULL),
--      garante uma campanha 'avulso' (espelha lib/drps-campanha.garantirCampanhaAvulsa)
--      e vincula as respostas órfãs a ela.
--   2) SET NOT NULL — APENAS se não restar nenhum nulo (DO block protege:
--      se ainda houver nulos, RAISE NOTICE e NÃO altera, pra não abortar o boot).
--      Se a coluna já for NOT NULL, é no-op silencioso.
-- ============================================================================

-- ── 1) Backfill: vincula respostas órfãs a uma campanha 'avulso' por empresa ──
do $$
declare
  v_inst_id  uuid;
  v_empresa  text;
  v_camp_id  uuid;
  v_token    text;
begin
  -- Instrumento global okebambo_v1 (default histórico) p/ a campanha avulsa.
  select id into v_inst_id
    from public.drps_instrumento
   where empresa_id is null and codigo = 'okebambo_v1' and ativo = true
   limit 1;

  for v_empresa in
    select distinct empresa_id
      from public.drps_resposta
     where campanha_id is null
  loop
    -- Reusa a 'avulso' existente se houver (espelha garantirCampanhaAvulsa);
    -- senão cria. Token único de alta entropia (gen_random_bytes b64url),
    -- com fallback p/ md5(random()) caso pgcrypto não exponha a função.
    begin
      v_token := replace(replace(replace(
        encode(gen_random_bytes(16), 'base64'),
        '+', '-'), '/', '_'), '=', '');
    exception when others then
      v_token := md5(random()::text || clock_timestamp()::text);
    end;

    insert into public.drps_campanha
      (empresa_id, instrumento_id, codigo, titulo, token, ciclo, ativo, expira_em)
    values
      (v_empresa, v_inst_id, 'avulso',
       'Avulso (sem campanha)', v_token, 'avulso', true, null)
    on conflict (empresa_id, codigo) do update
       set ativo = true
    returning id into v_camp_id;

    update public.drps_resposta
       set campanha_id = v_camp_id
     where empresa_id = v_empresa
       and campanha_id is null;
  end loop;
end$$;

-- ── 2) SET NOT NULL — protegido (só se 0 nulos) ──────────────────────────────
do $$
declare
  v_nulos bigint;
begin
  select count(*) into v_nulos
    from public.drps_resposta
   where campanha_id is null;

  if v_nulos = 0 then
    -- Idempotente: se já for NOT NULL, este ALTER é no-op (não erra).
    alter table public.drps_resposta
      alter column campanha_id set not null;
  else
    raise notice
      '0023: % respostas com campanha_id NULL — SET NOT NULL adiado (backfill incompleto).',
      v_nulos;
  end if;
end$$;
