-- ============================================================================
-- 0011 · Catálogo NR-1 oficial · 5 dimensões + 35 fatores psicossociais
-- ----------------------------------------------------------------------------
-- Fonte: NR-1 (Portaria MTE 1.419/2024) + material clínico da Okêbambo.
-- Catálogo GLOBAL (sem tenant) — todas as empresas referenciam os mesmos IDs.
-- Sem RLS; GRANT SELECT a previa_app. Inserções/atualizações só por migration
-- (super) ou por rota de admin futura.
--
-- Mapeamento eSocial S-2240: códigos aproximados (psicossocial agregado).
-- O eSocial ainda não tem códigos finos por fator; usamos '05.01.001' como
-- âncora "psicossocial-agregado" para compatibilidade até regulamentação.
--
-- IDs em PT-BR slug snake_case para legibilidade nos joins e logs.
-- ============================================================================

-- ── Dimensões (5) ──────────────────────────────────────────────────────────
create table if not exists public.dim_nr1 (
  id          text primary key,
  ordem       int  not null,
  nome        text not null,
  descricao   text not null
);

comment on table public.dim_nr1 is
  'Dimensões oficiais NR-1 (5 eixos agregadores). Catálogo global — sem RLS.';

-- ── Fatores (35) ───────────────────────────────────────────────────────────
create table if not exists public.fator_nr1 (
  id              text primary key,
  dim_id          text not null references public.dim_nr1(id) on delete restrict,
  nome            text not null,
  descricao       text not null,
  codigo_esocial  text,                -- '05.01.001' (psicossocial agregado) ou NULL
  ordem           int  not null
);

comment on table public.fator_nr1 is
  'Fatores psicossociais NR-1 (35 itens). codigo_esocial é o S-2240 aproximado.';

create index if not exists fator_nr1_dim_idx on public.fator_nr1 (dim_id, ordem);

-- ── Sem RLS (catálogo global) ──────────────────────────────────────────────
alter table public.dim_nr1   disable row level security;
alter table public.fator_nr1 disable row level security;

grant select on public.dim_nr1, public.fator_nr1 to previa_app;

-- ============================================================================
-- SEED · 5 dimensões
-- ============================================================================
insert into public.dim_nr1 (id, ordem, nome, descricao) values
  ('org_trabalho',     1, 'Organização do trabalho',
   'Sobrecarga, ritmo, jornada, autonomia e clareza de papéis.'),
  ('carga_emocional',  2, 'Carga emocional',
   'Exposição ao sofrimento e intensidade afetiva no trabalho.'),
  ('relacoes',         3, 'Relações de trabalho',
   'Comunicação, suporte da equipe, liderança e justiça organizacional.'),
  ('condicoes',        4, 'Condições de trabalho',
   'Ambiente físico: ruído, iluminação, privacidade, ergonomia.'),
  ('seguranca_emoc',   5, 'Segurança emocional',
   'Assédio, violência, eventos traumáticos e gestão de mudanças.')
on conflict (id) do update set
  ordem     = excluded.ordem,
  nome      = excluded.nome,
  descricao = excluded.descricao;

-- ============================================================================
-- SEED · 35 fatores (mapeamento eSocial S-2240: '05.01.001' agregado psicossocial)
-- ============================================================================

-- ── Organização do trabalho (9 fatores) ───────────────────────────────────
insert into public.fator_nr1 (id, dim_id, nome, descricao, codigo_esocial, ordem) values
  ('sobrecarga',                 'org_trabalho', 'Sobrecarga (excesso de demandas)',
   'Volume de demandas acima da capacidade.', '05.01.001', 1),
  ('subcarga',                   'org_trabalho', 'Subcarga (baixa demanda)',
   'Volume muito baixo de demandas — gera desengajamento.', '05.01.001', 2),
  ('ritmo_metas',                'org_trabalho', 'Ritmo e pressão por metas',
   'Ritmo intenso e pressão sustentada por metas.', '05.01.001', 3),
  ('jornada',                    'org_trabalho', 'Jornada/descanso insuficiente',
   'Jornada longa, intervalos curtos, recuperação insuficiente.', '05.01.001', 4),
  ('falta_pausas',               'org_trabalho', 'Falta de pausas entre atendimentos',
   'Sem intervalos mínimos entre atendimentos consecutivos.', '05.01.001', 5),
  ('falta_tempo_registros',      'org_trabalho', 'Falta de tempo para registros clínicos',
   'Sem janela protegida para registros, evoluções e relatórios.', '05.01.001', 6),
  ('baixa_autonomia',            'org_trabalho', 'Baixo controle/falta de autonomia',
   'Pouca margem de decisão sobre o próprio trabalho.', '05.01.001', 7),
  ('clareza_papel',              'org_trabalho', 'Baixa clareza de papel/função',
   'Indefinição do que esperam do profissional.', '05.01.001', 8),
  ('justica_org',                'org_trabalho', 'Baixa justiça organizacional',
   'Decisões/critérios percebidos como injustos ou opacos.', '05.01.001', 9)
on conflict (id) do update set
  dim_id = excluded.dim_id, nome = excluded.nome,
  descricao = excluded.descricao, codigo_esocial = excluded.codigo_esocial,
  ordem = excluded.ordem;

-- ── Relações de trabalho (7 fatores) ──────────────────────────────────────
insert into public.fator_nr1 (id, dim_id, nome, descricao, codigo_esocial, ordem) values
  ('mas_relacoes',               'relacoes', 'Más relações no local de trabalho',
   'Clima ruim, hostilidade ou desrespeito recorrente.', '05.01.001', 10),
  ('dificil_comunicacao',        'relacoes', 'Trabalho em condições de difícil comunicação',
   'Ambiente que dificulta comunicação clara entre pares.', '05.01.001', 11),
  ('remoto_isolado',             'relacoes', 'Trabalho remoto e isolado',
   'Atuação remota com baixo contato com colegas.', '05.01.001', 12),
  ('isolamento_prof',            'relacoes', 'Isolamento profissional',
   'Sem trocas técnicas/supervisão entre pares.', '05.01.001', 13),
  ('conflitos',                  'relacoes', 'Conflitos entre profissionais',
   'Conflitos interpessoais não resolvidos.', '05.01.001', 14),
  ('falta_suporte',              'relacoes', 'Falta de suporte/apoio no trabalho',
   'Sem retaguarda da equipe quando precisa.', '05.01.001', 15),
  ('falta_suporte_coord',        'relacoes', 'Falta de suporte da coordenação',
   'Coordenação ausente ou inacessível em momentos críticos.', '05.01.001', 16),
  ('falta_comunicacao_equipe',   'relacoes', 'Falta de comunicação entre equipe',
   'Informações importantes não circulam entre a equipe.', '05.01.001', 17)
on conflict (id) do update set
  dim_id = excluded.dim_id, nome = excluded.nome,
  descricao = excluded.descricao, codigo_esocial = excluded.codigo_esocial,
  ordem = excluded.ordem;

-- ── Carga emocional (8 fatores) ───────────────────────────────────────────
insert into public.fator_nr1 (id, dim_id, nome, descricao, codigo_esocial, ordem) values
  ('carga_emoc_trabalho',        'carga_emocional', 'Carga emocional do trabalho',
   'Atividade exige envolvimento emocional intenso e sustentado.', '05.01.001', 18),
  ('casos_complexos',            'carga_emocional', 'Atendimento de casos complexos',
   'Casos clínicos de alta complexidade técnica e afetiva.', '05.01.001', 19),
  ('contato_sofrimento',         'carga_emocional', 'Contato constante com sofrimento psíquico',
   'Exposição rotineira à dor/sofrimento de terceiros.', '05.01.001', 20),
  ('envolvimento_familias',      'carga_emocional', 'Envolvimento emocional com famílias',
   'Vínculo afetivo com famílias atendidas, sem distanciamento técnico.', '05.01.001', 21),
  ('atendimentos_intensos',      'carga_emocional', 'Atendimentos emocionalmente intensos',
   'Sequência de atendimentos com alta intensidade afetiva.', '05.01.001', 22),
  ('cansaco_acumulado',          'carga_emocional', 'Cansaço emocional acumulado',
   'Fadiga emocional que se acumula ao longo dos dias.', '05.01.001', 23),
  ('esgotamento_emoc',           'carga_emocional', 'Esgotamento emocional',
   'Quadro próximo de burnout — exaustão emocional persistente.', '05.01.001', 24),
  ('impacto_saude_mental',       'carga_emocional', 'Impacto na saúde mental',
   'Trabalho percebido como impactando saúde mental do profissional.', '05.01.001', 25)
on conflict (id) do update set
  dim_id = excluded.dim_id, nome = excluded.nome,
  descricao = excluded.descricao, codigo_esocial = excluded.codigo_esocial,
  ordem = excluded.ordem;

-- ── Condições de trabalho (6 fatores) ─────────────────────────────────────
insert into public.fator_nr1 (id, dim_id, nome, descricao, codigo_esocial, ordem) values
  ('espaco_inadequado',          'condicoes', 'Espaço inadequado para atendimento',
   'Sala/espaço não adequado para a prática.', '05.01.001', 26),
  ('falta_privacidade',          'condicoes', 'Falta de privacidade',
   'Sem privacidade auditiva/visual durante atendimentos.', '05.01.001', 27),
  ('ruido_interrupcoes',         'condicoes', 'Ruído ou interrupções',
   'Ambiente ruidoso ou com interrupções frequentes.', '05.01.001', 28),
  ('iluminacao',                 'condicoes', 'Iluminação inadequada',
   'Iluminação insuficiente ou desconfortável.', '05.01.001', 29),
  ('postura',                    'condicoes', 'Postura inadequada',
   'Mobiliário/postos que forçam posturas inadequadas.', '05.01.001', 30),
  ('sentado_prolongado',         'condicoes', 'Permanência prolongada sentado',
   'Longos períodos sentado sem alternância postural.', '05.01.001', 31)
on conflict (id) do update set
  dim_id = excluded.dim_id, nome = excluded.nome,
  descricao = excluded.descricao, codigo_esocial = excluded.codigo_esocial,
  ordem = excluded.ordem;

-- ── Segurança emocional (5 fatores) ───────────────────────────────────────
insert into public.fator_nr1 (id, dim_id, nome, descricao, codigo_esocial, ordem) values
  ('ameacas_agressoes',          'seguranca_emoc', 'Ameaças ou agressividade de pacientes/familiares',
   'Hostilidade/ameaças vindas do público atendido.', '05.01.001', 32),
  ('crise_durante_atend',        'seguranca_emoc', 'Situações de crise emocional durante atendimentos',
   'Crises agudas (pacientes/familiares) durante o atendimento.', '05.01.001', 33),
  ('assedio',                    'seguranca_emoc', 'Assédio de qualquer natureza',
   'Assédio moral, sexual ou organizacional.', '05.01.001', 34),
  ('eventos_traumaticos',        'seguranca_emoc', 'Eventos violentos ou traumáticos',
   'Exposição a eventos violentos ou traumáticos no trabalho.', '05.01.001', 35),
  ('ma_gestao_mudancas',         'seguranca_emoc', 'Má gestão de mudanças organizacionais',
   'Mudanças organizacionais conduzidas sem cuidado/transparência.', '05.01.001', 36),
  ('baixas_recompensas',         'seguranca_emoc', 'Baixas recompensas e reconhecimento',
   'Reconhecimento/contrapartidas percebidas como insuficientes.', '05.01.001', 37)
on conflict (id) do update set
  dim_id = excluded.dim_id, nome = excluded.nome,
  descricao = excluded.descricao, codigo_esocial = excluded.codigo_esocial,
  ordem = excluded.ordem;
