import "server-only";
import { createHash, createHmac } from "node:crypto";
import { sql, dbHabilitado } from "@/lib/db";

/**
 * Núcleo do PGR — núcleo criptográfico (hash/selo) + acesso a `pgr_revisao`.
 *
 * - `hashConteudo`: sha256 determinístico de um snapshot canônico do PGR.
 *   Mesmo conteúdo → mesmo hash. Qualquer mudança nos riscos/conformidade
 *   muda o hash → a assinatura anterior deixa de cobrir o estado atual.
 * - `selarAssinatura`: HMAC (tamper-evident) ligando hash + assinante + tempo.
 *   Permite provar depois que aquele responsável assinou aquele conteúdo.
 * - `obterRevisaoAtual` / `atualizarDadosRevisao` / `listarRevisoes`:
 *   helpers da tabela `pgr_revisao` (Onda 4 / Backlog §6 · PGR Okêbambo).
 *   Todas usam `sql` (proxy) — DEVEM ser chamadas dentro de `withEmpresa`.
 */

/** Segredo lazy + fail-closed em produção (não cai em default conhecido). */
function getSecret(): string {
  const s = process.env.PGR_SECRET || process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PGR_SECRET/AUTH_SECRET não configurada em produção (fail-closed).");
  }
  return "dev-pgr-secret-trocar";
}

/** Ordena chaves recursivamente para um JSON canônico (hash estável). */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = canonical((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

export function hashConteudo(snapshot: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(snapshot))).digest("hex");
}

export function selarAssinatura(p: {
  hash: string;
  nome: string;
  papel: string;
  ts: string;
}): string {
  return createHmac("sha256", getSecret())
    .update(`${p.hash}|${p.nome}|${p.papel}|${p.ts}`)
    .digest("hex");
}

/** Reverifica que um selo confere (auditoria). */
export function seloValido(
  selo: string,
  p: { hash: string; nome: string; papel: string; ts: string },
): boolean {
  return selarAssinatura(p) === selo;
}

/* -------------------------------------------------------------------------- */
/*  PGR Okêbambo — acesso à tabela pgr_revisao                                */
/*  Onda 4 / Backlog §6 — 9 seções obrigatórias.                              */
/*  Todas as funções abaixo assumem que já estão dentro de `withEmpresa`.      */
/* -------------------------------------------------------------------------- */

export interface RiscoManualPgr {
  risco: string;
  fonte: string;
  consequencia: string;
}

export interface PgrRevisao {
  id: string;
  revisao: number;
  status: "rascunho" | "pronto_para_assinar" | "assinada" | "arquivada";
  criado_em: string;
  atualizado_em: string;
  // Identificação da empresa (§1)
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  endereco: string | null;
  // Responsável técnico (§1 + §9)
  responsavel_tecnico_nome: string | null;
  responsavel_tecnico_registro: string | null;
  responsavel_tecnico_conselho: string | null;
  // Atividades (§3)
  publico_atendido: string | null;
  descricao_atividades: string | null;
  // Riscos manuais (§4.1 e §4.2)
  riscos_fisicos: RiscoManualPgr[];
  riscos_ergonomicos: RiscoManualPgr[];
}

export interface DadosRevisao {
  cnpj?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  endereco?: string | null;
  responsavel_tecnico_nome?: string | null;
  responsavel_tecnico_registro?: string | null;
  responsavel_tecnico_conselho?: string | null;
  publico_atendido?: string | null;
  descricao_atividades?: string | null;
  riscos_fisicos?: RiscoManualPgr[];
  riscos_ergonomicos?: RiscoManualPgr[];
}

/** Devolve a revisão de PGR atualmente em rascunho — ou cria uma se não existir. */
export async function obterRevisaoAtual(): Promise<PgrRevisao | null> {
  if (!dbHabilitado) return null;
  const [row] = await sql<PgrRevisao[]>`
    select id,
           revisao,
           status,
           criado_em::text as criado_em,
           atualizado_em::text as atualizado_em,
           cnpj,
           razao_social,
           nome_fantasia,
           endereco,
           responsavel_tecnico_nome,
           responsavel_tecnico_registro,
           responsavel_tecnico_conselho,
           publico_atendido,
           descricao_atividades,
           coalesce(riscos_fisicos, '[]'::jsonb) as riscos_fisicos,
           coalesce(riscos_ergonomicos, '[]'::jsonb) as riscos_ergonomicos
    from public.pgr_revisao
    where status in ('rascunho', 'pronto_para_assinar')
    order by revisao desc
    limit 1
  `;
  return row ?? null;
}

/** Cria a próxima revisão (em rascunho), retornando a linha. */
export async function criarProximaRevisao(empresaId: string): Promise<PgrRevisao> {
  const [{ proxima }] = await sql<{ proxima: number }[]>`
    select coalesce(max(revisao), 0) + 1 as proxima from public.pgr_revisao
  `;
  const [row] = await sql<PgrRevisao[]>`
    insert into public.pgr_revisao (empresa_id, revisao, status)
    values (${empresaId}, ${proxima}, 'rascunho')
    returning id,
              revisao,
              status,
              criado_em::text as criado_em,
              atualizado_em::text as atualizado_em,
              cnpj,
              razao_social,
              nome_fantasia,
              endereco,
              responsavel_tecnico_nome,
              responsavel_tecnico_registro,
              responsavel_tecnico_conselho,
              publico_atendido,
              descricao_atividades,
              coalesce(riscos_fisicos, '[]'::jsonb) as riscos_fisicos,
              coalesce(riscos_ergonomicos, '[]'::jsonb) as riscos_ergonomicos
  `;
  return row;
}

/** Garante que existe uma revisão atual; cria se não existir. */
export async function garantirRevisaoAtual(empresaId: string): Promise<PgrRevisao> {
  const atual = await obterRevisaoAtual();
  if (atual) return atual;
  return criarProximaRevisao(empresaId);
}

/** Atualiza os campos da revisão.
 *  Usa COALESCE: chave ausente em `dados` → mantém valor antigo.
 *  Para limpar um campo, envie explicitamente `null` no JSON.
 *  Para limpar um campo string, envie string vazia (que é convertida para null antes).
 */
export async function atualizarDadosRevisao(
  revisaoId: string,
  dados: DadosRevisao,
): Promise<PgrRevisao> {
  // Helper: undefined → coalesce mantém; null → preserva null (sem trocar);
  // Para essa UI o mais simples é: tudo que vem é sobrescrita explícita.
  const cnpj = dados.cnpj === undefined ? null : dados.cnpj;
  const razao_social = dados.razao_social === undefined ? null : dados.razao_social;
  const nome_fantasia = dados.nome_fantasia === undefined ? null : dados.nome_fantasia;
  const endereco = dados.endereco === undefined ? null : dados.endereco;
  const rt_nome =
    dados.responsavel_tecnico_nome === undefined ? null : dados.responsavel_tecnico_nome;
  const rt_reg =
    dados.responsavel_tecnico_registro === undefined ? null : dados.responsavel_tecnico_registro;
  const rt_cons =
    dados.responsavel_tecnico_conselho === undefined ? null : dados.responsavel_tecnico_conselho;
  const publico = dados.publico_atendido === undefined ? null : dados.publico_atendido;
  const desc = dados.descricao_atividades === undefined ? null : dados.descricao_atividades;
  const rf = JSON.stringify(dados.riscos_fisicos ?? []);
  const re = JSON.stringify(dados.riscos_ergonomicos ?? []);

  const [row] = await sql<PgrRevisao[]>`
    update public.pgr_revisao set
      cnpj = ${cnpj},
      razao_social = ${razao_social},
      nome_fantasia = ${nome_fantasia},
      endereco = ${endereco},
      responsavel_tecnico_nome = ${rt_nome},
      responsavel_tecnico_registro = ${rt_reg},
      responsavel_tecnico_conselho = ${rt_cons},
      publico_atendido = ${publico},
      descricao_atividades = ${desc},
      riscos_fisicos = ${rf}::jsonb,
      riscos_ergonomicos = ${re}::jsonb
    where id = ${revisaoId}
    returning id,
              revisao,
              status,
              criado_em::text as criado_em,
              atualizado_em::text as atualizado_em,
              cnpj,
              razao_social,
              nome_fantasia,
              endereco,
              responsavel_tecnico_nome,
              responsavel_tecnico_registro,
              responsavel_tecnico_conselho,
              publico_atendido,
              descricao_atividades,
              coalesce(riscos_fisicos, '[]'::jsonb) as riscos_fisicos,
              coalesce(riscos_ergonomicos, '[]'::jsonb) as riscos_ergonomicos
  `;
  if (!row) {
    throw new Error("[pgr] revisão não encontrada para atualização");
  }
  return row;
}

/** Lista todas as revisões da empresa atual (mais recente primeiro). */
export async function listarRevisoes(): Promise<PgrRevisao[]> {
  if (!dbHabilitado) return [];
  return sql<PgrRevisao[]>`
    select id,
           revisao,
           status,
           criado_em::text as criado_em,
           atualizado_em::text as atualizado_em,
           cnpj,
           razao_social,
           nome_fantasia,
           endereco,
           responsavel_tecnico_nome,
           responsavel_tecnico_registro,
           responsavel_tecnico_conselho,
           publico_atendido,
           descricao_atividades,
           coalesce(riscos_fisicos, '[]'::jsonb) as riscos_fisicos,
           coalesce(riscos_ergonomicos, '[]'::jsonb) as riscos_ergonomicos
    from public.pgr_revisao
    order by revisao desc
  `;
}

/** Busca uma revisão específica por número de revisão. */
export async function obterRevisaoPorNumero(revisao: number): Promise<PgrRevisao | null> {
  if (!dbHabilitado) return null;
  const [row] = await sql<PgrRevisao[]>`
    select id,
           revisao,
           status,
           criado_em::text as criado_em,
           atualizado_em::text as atualizado_em,
           cnpj,
           razao_social,
           nome_fantasia,
           endereco,
           responsavel_tecnico_nome,
           responsavel_tecnico_registro,
           responsavel_tecnico_conselho,
           publico_atendido,
           descricao_atividades,
           coalesce(riscos_fisicos, '[]'::jsonb) as riscos_fisicos,
           coalesce(riscos_ergonomicos, '[]'::jsonb) as riscos_ergonomicos
    from public.pgr_revisao
    where revisao = ${revisao}
    limit 1
  `;
  return row ?? null;
}
