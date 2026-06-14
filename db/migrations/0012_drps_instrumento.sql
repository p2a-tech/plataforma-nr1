-- ============================================================================
-- 0012 · DRPS · Instrumento (questionário) + perguntas + opções
-- ----------------------------------------------------------------------------
-- Estrutura genérica para qualquer questionário DRPS. Suporta:
--   - instrumentos globais (empresa_id NULL = template usável por todas) e
--   - instrumentos próprios da empresa (empresa_id setado, isolado por RLS).
--
-- Seed: template 'Okebambo' (21 perguntas) — usado como base por todas as
-- empresas até criarem instrumentos próprios.
-- ============================================================================

-- ── Instrumento ────────────────────────────────────────────────────────────
create table if not exists public.drps_instrumento (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  text references public.empresas(id) on delete cascade,  -- NULL = global
  codigo      text not null,                                            -- 'okebambo_v1' etc.
  titulo      text not null,
  descricao   text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  -- Codigo é único por escopo (empresa ou global). Tratamos NULL como global.
  -- Como Postgres considera NULL != NULL no UNIQUE padrão, complementamos
  -- com um índice parcial pra forçar a unicidade entre templates globais.
  constraint drps_instrumento_codigo_uk unique (empresa_id, codigo)
);

-- Dedupe defensivo (caso uma versão anterior tenha inserido duplicatas globais
-- antes da existência do índice parcial). Mantém o mais antigo.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'drps_instrumento') then
    with dups as (
      select id, row_number() over (partition by codigo order by criado_em asc) as rn
        from public.drps_instrumento
       where empresa_id is null
    )
    delete from public.drps_instrumento i
     using dups
     where i.id = dups.id and dups.rn > 1;
  end if;
end$$;

create unique index if not exists drps_instrumento_codigo_global_uk
  on public.drps_instrumento (codigo)
  where empresa_id is null;

comment on table public.drps_instrumento is
  'Instrumento DRPS (questionário). empresa_id NULL = template global.';

-- ── Pergunta ───────────────────────────────────────────────────────────────
create table if not exists public.drps_pergunta (
  id              uuid primary key default gen_random_uuid(),
  instrumento_id  uuid not null references public.drps_instrumento(id) on delete cascade,
  ordem           int  not null,
  codigo          text not null,                -- 'Q1','Q5',etc.
  enunciado       text not null,
  tipo            text not null check (tipo in (
                    'demografia',
                    'likert5_inverso',          -- Sempre=1 ... Nunca=5
                    'likert3_freq',             -- Raramente=1, Às vezes=2, Frequentemente=3
                    'impacto4',                 -- Não=1, Levemente=2, Moderadamente=3, Significativamente=4
                    'esgotamento5',             -- Nunca=1...Sempre=5
                    'multi_choice',
                    'texto'
                  )),
  peso            numeric not null default 1,
  dim_id          text references public.dim_nr1(id) on delete set null,
  constraint drps_pergunta_codigo_uk unique (instrumento_id, codigo)
);

create index if not exists drps_pergunta_inst_idx on public.drps_pergunta (instrumento_id, ordem);

comment on column public.drps_pergunta.tipo is
  'Tipos de escala suportados — cada tipo tem semântica fixa de valor_int.';

-- ── Opções (para multi_choice e demografia categórica) ─────────────────────
create table if not exists public.drps_opcao (
  id          uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null references public.drps_pergunta(id) on delete cascade,
  ordem       int  not null,
  label       text not null,
  valor       int,                              -- opcional, usado em algumas demografias
  constraint drps_opcao_uk unique (pergunta_id, ordem)
);

create index if not exists drps_opcao_pergunta_idx on public.drps_opcao (pergunta_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Política: linhas globais (empresa_id IS NULL) são visíveis a todos; linhas
-- da empresa só pra própria empresa. Perguntas/opções herdam do instrumento.
alter table public.drps_instrumento enable row level security;
alter table public.drps_instrumento force row level security;
drop policy if exists tenant_isolation on public.drps_instrumento;
create policy tenant_isolation on public.drps_instrumento
  for all to previa_app
  using (empresa_id is null or empresa_id = current_setting('app.empresa_id', true))
  with check (empresa_id is null or empresa_id = current_setting('app.empresa_id', true));

alter table public.drps_pergunta enable row level security;
alter table public.drps_pergunta force row level security;
drop policy if exists tenant_isolation on public.drps_pergunta;
create policy tenant_isolation on public.drps_pergunta
  for all to previa_app
  using (
    exists (select 1 from public.drps_instrumento i
             where i.id = drps_pergunta.instrumento_id
               and (i.empresa_id is null
                    or i.empresa_id = current_setting('app.empresa_id', true)))
  )
  with check (
    exists (select 1 from public.drps_instrumento i
             where i.id = drps_pergunta.instrumento_id
               and (i.empresa_id is null
                    or i.empresa_id = current_setting('app.empresa_id', true)))
  );

alter table public.drps_opcao enable row level security;
alter table public.drps_opcao force row level security;
drop policy if exists tenant_isolation on public.drps_opcao;
create policy tenant_isolation on public.drps_opcao
  for all to previa_app
  using (
    exists (select 1 from public.drps_pergunta p
              join public.drps_instrumento i on i.id = p.instrumento_id
             where p.id = drps_opcao.pergunta_id
               and (i.empresa_id is null
                    or i.empresa_id = current_setting('app.empresa_id', true)))
  )
  with check (
    exists (select 1 from public.drps_pergunta p
              join public.drps_instrumento i on i.id = p.instrumento_id
             where p.id = drps_opcao.pergunta_id
               and (i.empresa_id is null
                    or i.empresa_id = current_setting('app.empresa_id', true)))
  );

grant select, insert, update, delete on public.drps_instrumento to previa_app;
grant select, insert, update, delete on public.drps_pergunta    to previa_app;
grant select, insert, update, delete on public.drps_opcao       to previa_app;

-- ============================================================================
-- SEED · Template Okêbambo (21 perguntas) — instrumento global
-- ----------------------------------------------------------------------------
-- Idempotente: usa codigo como chave natural. Limpa perguntas/opcoes do
-- instrumento ao re-rodar pra recriar do zero (fonte de verdade é este arquivo).
-- ============================================================================
do $$
declare
  v_inst_id uuid;
  v_q       uuid;
begin
  -- 1) Garante o instrumento (chave: empresa_id=NULL, codigo='okebambo_v1').
  --    Como Postgres trata NULL como distinto no UNIQUE padrão, fazemos
  --    SELECT-then-(INSERT|UPDATE) explícito — combina com o índice parcial
  --    drps_instrumento_codigo_global_uk pra garantir idempotência total.
  --    Também removemos duplicatas pré-existentes caso a migration antiga
  --    tenha rodado mais de uma vez.
  with cte as (
    select id from public.drps_instrumento
     where empresa_id is null and codigo = 'okebambo_v1'
     order by criado_em asc
     offset 1
  )
  delete from public.drps_instrumento i
   using cte
   where i.id = cte.id;

  select id into v_inst_id from public.drps_instrumento
    where empresa_id is null and codigo = 'okebambo_v1'
    limit 1;

  if v_inst_id is null then
    insert into public.drps_instrumento (empresa_id, codigo, titulo, descricao, ativo)
    values (
      null, 'okebambo_v1',
      'DRPS Okêbambo · NR-1 (21 perguntas)',
      'Instrumento de Diagnóstico de Riscos Psicossociais aplicado pela Clínica Okêbambo Saúde e Educação. Cobre demografia (4) · Likert 1-5 inversa (12) · Likert 1-3 emocional (2) · impacto/esgotamento (2) · multi-choice + livre (3).',
      true
    )
    returning id into v_inst_id;
  else
    update public.drps_instrumento
       set titulo    = 'DRPS Okêbambo · NR-1 (21 perguntas)',
           descricao = 'Instrumento de Diagnóstico de Riscos Psicossociais aplicado pela Clínica Okêbambo Saúde e Educação. Cobre demografia (4) · Likert 1-5 inversa (12) · Likert 1-3 emocional (2) · impacto/esgotamento (2) · multi-choice + livre (3).',
           ativo     = true
     where id = v_inst_id;
  end if;

  -- 2) Limpa perguntas/opções antigas (cascade na FK) pra recriar deterministico
  delete from public.drps_pergunta where instrumento_id = v_inst_id;

  -- ── Demografia (Q1..Q4) ───────────────────────────────────────────────
  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id, 1, 'Q1', 'Em qual setor você atua?', 'demografia', 0, null) returning id into v_q;
  insert into public.drps_opcao (pergunta_id, ordem, label) values
    (v_q, 1, 'Diretoria'),
    (v_q, 2, 'Coordenação Técnica'),
    (v_q, 3, 'Operacional'),
    (v_q, 4, 'Administrativa'),
    (v_q, 5, 'Apoio'),
    (v_q, 6, 'Comercial');

  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id, 2, 'Q2', 'Qual sua função/cargo?', 'demografia', 0, null);

  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id, 3, 'Q3', 'Há quanto tempo você trabalha na empresa?', 'demografia', 0, null) returning id into v_q;
  insert into public.drps_opcao (pergunta_id, ordem, label) values
    (v_q, 1, 'Menos de 6 meses'),
    (v_q, 2, '6 meses a 1 ano'),
    (v_q, 3, '1 a 3 anos'),
    (v_q, 4, 'Mais de 3 anos');

  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id, 4, 'Q4', 'Qual sua forma de atuação?', 'demografia', 0, null) returning id into v_q;
  insert into public.drps_opcao (pergunta_id, ordem, label) values
    (v_q, 1, 'CLT'),
    (v_q, 2, 'PJ'),
    (v_q, 3, 'Autônomo'),
    (v_q, 4, 'Terceirizado'),
    (v_q, 5, 'Estágio');

  -- ── Likert 1-5 inversa (Sempre=1 ... Nunca=5) · Q5..Q10, Q13..Q16 ─────
  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id,  5, 'Q5',  'A quantidade de atendimentos/tarefas que você realiza é adequada para o seu tempo de trabalho?',
     'likert5_inverso', 1, 'org_trabalho'),
    (v_inst_id,  6, 'Q6',  'Você tem intervalos suficientes entre os atendimentos?',
     'likert5_inverso', 1, 'org_trabalho'),
    (v_inst_id,  7, 'Q7',  'Você consegue realizar registros/relatórios/planejamentos sem pressa?',
     'likert5_inverso', 1, 'org_trabalho'),
    (v_inst_id,  8, 'Q8',  'As condições do ambiente (espaço, ruído, iluminação, mobiliário) são adequadas?',
     'likert5_inverso', 1, 'condicoes'),
    (v_inst_id,  9, 'Q9',  'Você dispõe de privacidade e tranquilidade nos atendimentos?',
     'likert5_inverso', 1, 'condicoes'),
    (v_inst_id, 10, 'Q10', 'O ambiente é acolhedor e respeitoso entre profissionais?',
     'likert5_inverso', 1, 'relacoes'),
    (v_inst_id, 13, 'Q13', 'Você tem suporte/espaço para discutir casos difíceis?',
     'likert5_inverso', 1, 'relacoes'),
    (v_inst_id, 14, 'Q14', 'Você sente apoio da equipe quando precisa?',
     'likert5_inverso', 1, 'relacoes'),
    (v_inst_id, 15, 'Q15', 'A comunicação entre profissionais é clara e respeitosa?',
     'likert5_inverso', 1, 'relacoes'),
    (v_inst_id, 16, 'Q16', 'Você se sente confortável para falar sobre dificuldades?',
     'likert5_inverso', 1, 'relacoes');

  -- ── Likert 1-3 emocional · Q11, Q12 ───────────────────────────────────
  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id, 11, 'Q11', 'Com que frequência você lida com situações emocionalmente difíceis no trabalho?',
     'likert3_freq', 1, 'carga_emocional'),
    (v_inst_id, 12, 'Q12', 'Com que frequência você sente cansaço emocional após atendimentos/dias de trabalho?',
     'likert3_freq', 1, 'carga_emocional');

  -- ── Impacto / esgotamento · Q17, Q18 ──────────────────────────────────
  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id, 17, 'Q17', 'Você sente que o trabalho tem impactado sua saúde emocional/mental?',
     'impacto4', 1, 'carga_emocional');

  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id, 18, 'Q18', 'Você já se sentiu esgotado emocionalmente em decorrência do trabalho?',
     'esgotamento5', 1, 'carga_emocional');

  -- ── Multi-choice / livre · Q19, Q20, Q21 ──────────────────────────────
  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id, 19, 'Q19', 'Na sua percepção, qual o maior gerador de estresse no trabalho?',
     'multi_choice', 1, null) returning id into v_q;
  insert into public.drps_opcao (pergunta_id, ordem, label) values
    (v_q, 1, 'Agenda e agendamentos'),
    (v_q, 2, 'Conflitos entre profissionais'),
    (v_q, 3, 'Ruído ou interrupções'),
    (v_q, 4, 'Falta de organização processual'),
    (v_q, 5, 'Falta de suporte da coordenação'),
    (v_q, 6, 'Falta de tempo para registros clínicos'),
    (v_q, 7, 'Falta de privacidade'),
    (v_q, 8, 'Outro (especificar no comentário)');

  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id, 20, 'Q20', 'Que sugestões de melhoria você indicaria para reduzir o estresse no trabalho?',
     'multi_choice', 1, null) returning id into v_q;
  insert into public.drps_opcao (pergunta_id, ordem, label) values
    (v_q, 1, 'Ajustes na agenda'),
    (v_q, 2, 'Treinamento para manejo de crises'),
    (v_q, 3, 'Intervalos mínimos entre atendimentos'),
    (v_q, 4, 'Limite diário de pacientes'),
    (v_q, 5, 'Reuniões efetivas de supervisão clínica'),
    (v_q, 6, 'Gerenciamento presente'),
    (v_q, 7, 'Outro (especificar no comentário)');

  insert into public.drps_pergunta (instrumento_id, ordem, codigo, enunciado, tipo, peso, dim_id) values
    (v_inst_id, 21, 'Q21', 'Comentários, sugestões ou observações livres (opcional).',
     'texto', 0, null);
end$$;
