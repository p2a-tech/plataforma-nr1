-- ============================================================================
-- 0020 · Notificações reais + Reset de senha & Lockout (Onda 6 · Dev B)
-- ----------------------------------------------------------------------------
-- Três tabelas que compartilham a infra de e-mail (lib/notify.ts):
--
--   1. notificacoes        — trilha de despacho (risco_grave, dsar, reset_senha,
--                            generico). Observability/admin: SEM RLS.
--   2. password_reset_tokens — tokens de reset (sha256), TTL 1h, uso único.
--   3. login_attempts      — tentativas de login (hash de email+IP) para lockout.
--
-- DECISÃO DE RLS (documentada):
--   Estas três tabelas são acessadas SEMPRE via `sqlAdmin` (role super, bypass de
--   RLS), porque operam FORA de qualquer sessão de empresa:
--     - notificacoes mistura linhas com empresa_id e empresa_id NULL (ex.: DSAR
--       de fila ainda não classificada, reset de senha) — é trilha de
--       observabilidade global, como `acesso_log`/`leads_lp`. Habilitar RLS por
--       empresa esconderia as linhas NULL e quebraria o painel admin.
--     - password_reset_tokens e login_attempts são PRÉ-sessão (o usuário ainda
--       não está autenticado, não há `app.empresa_id`).
--   Logo: NÃO habilitamos RLS aqui. Como defesa em profundidade, os GRANTs a
--   `previa_app` são mínimos (o necessário caso a escrita migre para o cliente
--   em escopo). A escrita de produção usa `sqlAdmin`.
--
-- Idempotente: create table if not exists / create index if not exists / grants
-- são re-aplicáveis sem erro.
-- ============================================================================

-- ── 1. notificacoes ─────────────────────────────────────────────────────────
create table if not exists public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in (
                'risco_grave','dsar','reset_senha','generico'
              )),
  empresa_id  text references public.empresas(id) on delete set null,
  titulo      text not null,
  corpo       text not null,
  canal       text,                              -- 'email' | 'slack' | 'persistido'
  status      text not null default 'enfileirada'
              check (status in ('enfileirada','enviada','falhou')),
  criado_em   timestamptz not null default now()
);

comment on table public.notificacoes is
  'Trilha de notificações despachadas (lib/notify.ts). Observability/admin — '
  'sem RLS; acesso via sqlAdmin. empresa_id pode ser NULL (DSAR de triagem, reset).';

create index if not exists notificacoes_tipo_criado_idx
  on public.notificacoes (tipo, criado_em desc);
create index if not exists notificacoes_empresa_criado_idx
  on public.notificacoes (empresa_id, criado_em desc);

-- Defesa em profundidade: grant mínimo. Escrita de produção usa sqlAdmin.
grant select, insert, update on public.notificacoes to previa_app;

-- ── 2. password_reset_tokens ────────────────────────────────────────────────
create table if not exists public.password_reset_tokens (
  id            uuid primary key default gen_random_uuid(),
  usuario_email text not null,
  token_hash    text not null,                   -- sha256(token) em hex
  expira_em     timestamptz not null,
  usado_em      timestamptz,
  criado_em     timestamptz not null default now()
);

comment on table public.password_reset_tokens is
  'Tokens de reset de senha. Guarda sha256(token), nunca o token em claro. '
  'TTL 1h, uso único (usado_em). Cross-tenant/pré-sessão — acesso via sqlAdmin.';

create index if not exists password_reset_tokens_hash_idx
  on public.password_reset_tokens (token_hash);
create index if not exists password_reset_tokens_email_idx
  on public.password_reset_tokens (usuario_email);

grant select, insert, update on public.password_reset_tokens to previa_app;

-- ── 3. login_attempts ───────────────────────────────────────────────────────
create table if not exists public.login_attempts (
  id         bigserial primary key,
  email_hash text,                               -- sha256(email + sal)
  ip_hash    text,                               -- sha256(ip + sal)
  sucesso    boolean not null,
  criado_em  timestamptz not null default now()
);

comment on table public.login_attempts is
  'Tentativas de login para lockout anti-brute-force. Nunca grava email/IP em '
  'claro (só hash com LP_IP_SALT/AUTH_SECRET). Cross-tenant — acesso via sqlAdmin.';

create index if not exists login_attempts_email_criado_idx
  on public.login_attempts (email_hash, criado_em desc);
create index if not exists login_attempts_ip_criado_idx
  on public.login_attempts (ip_hash, criado_em desc);

-- DELETE permitido: ao logar com sucesso limpamos as falhas recentes do email.
grant select, insert, delete on public.login_attempts to previa_app;
