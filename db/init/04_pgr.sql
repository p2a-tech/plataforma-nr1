-- ============================================================================
-- PrevIA · assinaturas digitais do PGR (decisão humana assinada — NR-1)
--   * conteudo_hash: sha256 do snapshot do PGR no momento da assinatura
--   * selo: HMAC (tamper-evident) sobre hash + assinante + timestamp
--   * resumo: snapshot legível (nº riscos, conformidade, distribuição)
-- ============================================================================

create table if not exists public.pgr_assinaturas (
  id                  uuid primary key default gen_random_uuid(),
  empresa_cnpj        text not null,
  revisao             int  not null,
  conteudo_hash       text not null,
  resumo              jsonb not null,
  assinante_nome      text not null,
  assinante_papel     text not null,
  assinante_registro  text,
  selo                text not null,
  assinado_em         timestamptz not null default now()
);

create index if not exists pgr_assinaturas_empresa_idx
  on public.pgr_assinaturas (empresa_cnpj, assinado_em desc);
