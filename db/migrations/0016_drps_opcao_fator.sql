-- ============================================================================
-- 0016 · DRPS · Coluna fator_id em drps_opcao
-- ----------------------------------------------------------------------------
-- Fecha o gap de contrato entre Dev A (catálogo NR-1 / instrumento DRPS) e
-- Dev B (matriz de risco). A função `sugerirProbabilidade` em
-- `lib/matriz-risco-server.ts` faz JOIN em `drps_opcao o ON o.fator_id = $1`,
-- mas a tabela `drps_opcao` (criada na 0012) não tinha essa coluna — quebrava
-- a página /riscos em 500 sempre que existia ao menos uma resposta DRPS.
--
-- Esta migration:
--   1) Adiciona `fator_id text` (FK opcional para fator_nr1) + índice parcial.
--   2) Faz UPDATE idempotente mapeando as 12 opções de Q19/Q20 do template
--      'okebambo_v1' para os fatores NR-1 mais próximos (catálogo da 0011).
--
-- IDs de fator usados (verificados no banco com `select id from fator_nr1`):
--   sobrecarga · conflitos · ruido_interrupcoes · clareza_papel ·
--   falta_suporte_coord · falta_tempo_registros · falta_pausas ·
--   eventos_traumaticos · falta_suporte · mas_relacoes
-- ============================================================================

-- ── 1) Schema ──────────────────────────────────────────────────────────────
alter table public.drps_opcao
  add column if not exists fator_id text
  references public.fator_nr1(id) on delete set null;

create index if not exists drps_opcao_fator_idx
  on public.drps_opcao(fator_id)
  where fator_id is not null;

comment on column public.drps_opcao.fator_id is
  'Mapeamento da opção (multi_choice) para um fator NR-1. Usado por '
  'sugerirProbabilidade() pra derivar probabilidade a partir da frequência '
  'de citação em Q19/Q20. NULL = opção sem fator equivalente (ex.: "Outro").';

-- ── 2) Seed idempotente do mapeamento Q19 (ofensores) ──────────────────────
-- Cada UPDATE filtra por (label, codigo_pergunta IN ('Q19','Q20')) — chaves
-- naturais do template Okebambo. Re-rodar é seguro (idempotente).

do $$
declare
  v_inst_id uuid;
begin
  -- Resolve o instrumento global okebambo_v1 (pode não existir em ambientes
  -- de teste sem seed; nesse caso, os UPDATEs simplesmente não afetam linhas).
  select id into v_inst_id
    from public.drps_instrumento
   where empresa_id is null and codigo = 'okebambo_v1'
   limit 1;

  if v_inst_id is null then
    raise notice '0016: instrumento okebambo_v1 ausente — pulando seed de fator_id.';
    return;
  end if;

  -- ─── Q19 · Maior gerador de estresse (ofensor → fator) ────────────────
  update public.drps_opcao o
     set fator_id = 'sobrecarga'
   where o.label = 'Agenda e agendamentos'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q19'
     );

  update public.drps_opcao o
     set fator_id = 'conflitos'
   where o.label = 'Conflitos entre profissionais'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q19'
     );

  update public.drps_opcao o
     set fator_id = 'ruido_interrupcoes'
   where o.label = 'Ruído ou interrupções'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q19'
     );

  update public.drps_opcao o
     set fator_id = 'clareza_papel'
   where o.label = 'Falta de organização processual'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q19'
     );

  update public.drps_opcao o
     set fator_id = 'falta_suporte_coord'
   where o.label = 'Falta de suporte da coordenação'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q19'
     );

  update public.drps_opcao o
     set fator_id = 'falta_tempo_registros'
   where o.label = 'Falta de tempo para registros clínicos'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q19'
     );

  update public.drps_opcao o
     set fator_id = 'falta_privacidade'
   where o.label = 'Falta de privacidade'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q19'
     );

  -- ─── Q20 · Sugestões de melhoria (melhoria → fator que ela RESOLVE) ───
  update public.drps_opcao o
     set fator_id = 'sobrecarga'
   where o.label = 'Ajustes na agenda'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q20'
     );

  update public.drps_opcao o
     set fator_id = 'eventos_traumaticos'
   where o.label = 'Treinamento para manejo de crises'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q20'
     );

  update public.drps_opcao o
     set fator_id = 'falta_pausas'
   where o.label = 'Intervalos mínimos entre atendimentos'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q20'
     );

  update public.drps_opcao o
     set fator_id = 'sobrecarga'
   where o.label = 'Limite diário de pacientes'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q20'
     );

  update public.drps_opcao o
     set fator_id = 'falta_suporte'
   where o.label = 'Reuniões efetivas de supervisão clínica'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q20'
     );

  update public.drps_opcao o
     set fator_id = 'falta_suporte_coord'
   where o.label = 'Gerenciamento presente'
     and o.pergunta_id in (
       select id from public.drps_pergunta
        where instrumento_id = v_inst_id and codigo = 'Q20'
     );
end$$;
