-- ============================================================================
-- 0024 · Teleconsulta ao vivo (LiveKit) — metadados operacionais (Onda 7 · Dev C)
-- ----------------------------------------------------------------------------
-- Registra apenas METADADOS de uma sessão de teleconsulta por vídeo:
-- quando começou/terminou, duração e se gerou análise. POR DESIGN:
--   - SEM transcript (a transcrição vive no navegador via Web Speech API e é
--     descartada — nunca persiste, igual ao fluxo de anexar transcrição).
--   - SEM PII do paciente (nome do paciente é só display efêmero no token).
--   - `sala` é um identificador anônimo e imprevisível ('tc-' + hex).
--
-- DECISÃO DE RLS (documentada):
--   Esta tabela é METADADO OPERACIONAL, escrita via `sqlAdmin` (como
--   `notificacoes`/`acesso_log` na 0020). `empresa_id` e `clinica_id` podem ser
--   NULL (sessão anônima antes de qualquer vínculo). Habilitar RLS por empresa
--   esconderia as linhas NULL e quebraria a contagem operacional. Logo:
--   NÃO habilitamos RLS. GRANTs mínimos a `previa_app` como defesa em
--   profundidade (caso a escrita migre para o cliente em escopo no futuro).
--
-- Idempotente: create table/index if not exists + grants re-aplicáveis sem erro.
-- ============================================================================

create table if not exists public.teleconsulta_sessao (
  id           uuid primary key default gen_random_uuid(),
  -- Ambos opcionais: a sessão pode nascer anônima (link de convidado) antes de
  -- qualquer vínculo formal com empresa/clínica.
  empresa_id   text references public.empresas(id) on delete set null,
  clinica_id   text references public.clinicas(id) on delete set null,
  -- Nome anônimo e imprevisível da sala LiveKit ('tc-' + hex). Sem PII.
  sala         text not null,
  iniciada_em  timestamptz not null default now(),
  encerrada_em timestamptz,
  duracao_seg  int,
  tem_analise  boolean not null default false
);

comment on table public.teleconsulta_sessao is
  'Metadados operacionais de teleconsultas LiveKit. SEM transcript, SEM PII do '
  'paciente. Sala anônima. Sem RLS — acesso via sqlAdmin (igual notificacoes).';

-- Listagem por clínica/empresa em ordem cronológica (uso operacional/admin).
create index if not exists teleconsulta_sessao_clinica_idx
  on public.teleconsulta_sessao (clinica_id, iniciada_em desc);
create index if not exists teleconsulta_sessao_empresa_idx
  on public.teleconsulta_sessao (empresa_id, iniciada_em desc);

-- Defesa em profundidade: grant mínimo. Escrita de produção usa sqlAdmin.
grant select, insert, update on public.teleconsulta_sessao to previa_app;
