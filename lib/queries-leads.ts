import "server-only";
// Console Admin de leads é cross-tenant por design (pré-venda, fila global).
// `leads_lp` fica fora do RLS por empresa → usar `sqlAdmin` direto.
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";

/**
 * Camada de leitura/escrita do Console de Leads (admin /admin/leads).
 *
 * - `listarLeads(filtros)` — busca paginada com filtros opcionais.
 * - `contarLeads(filtros)` — count total para paginação.
 * - `atualizarStatusLead(id, status, notas?)` — transição no pipeline.
 * - `resumoFunil(filtros)` — contadores por status (alimenta cards).
 *
 * Convenções:
 *   - Toda função é defensiva: se DB indisponível ou query quebrar, devolve
 *     defaults vazios em vez de propagar erro (admin renderiza estado honesto).
 *   - `since`/`until` operam sobre `criado_em` (data de entrada do lead).
 *   - Filtros vazios/undefined são ignorados — só aplicam quando preenchidos.
 */

export type LeadTipo = "empresa" | "clinica";
export type LeadStatus = "novo" | "contatado" | "qualificado" | "perdido" | "convertido";

export const STATUS_VALIDOS: readonly LeadStatus[] = [
  "novo",
  "contatado",
  "qualificado",
  "perdido",
  "convertido",
] as const;

export interface LeadRow {
  id: string;
  tipo: LeadTipo;
  nome: string;
  email: string;
  telefone: string | null;
  empresa_nome: string | null;
  cargo: string | null;
  colaboradores: number | null;
  conselho: string | null;
  mensagem: string | null;
  status: LeadStatus;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  contatado_em: string | null;
  notas_internas: string | null;
  criado_em: string;
}

export interface FiltrosLeads {
  tipo?: LeadTipo;
  status?: LeadStatus;
  utm_campaign?: string;
  since?: string; // ISO date (YYYY-MM-DD) — `criado_em >= since`
  until?: string; // ISO date (YYYY-MM-DD) — `criado_em <= until` (fim do dia)
  limit?: number;
  offset?: number;
}

export interface ResumoFunil {
  novo: number;
  contatado: number;
  qualificado: number;
  convertido: number;
  perdido: number;
  total: number;
}

const RESUMO_VAZIO: ResumoFunil = {
  novo: 0,
  contatado: 0,
  qualificado: 0,
  convertido: 0,
  perdido: 0,
  total: 0,
};

/** Normaliza filtros: trim em strings, descarta vazios. */
function norm(f: FiltrosLeads | undefined): FiltrosLeads {
  if (!f) return {};
  const t = (s: string | undefined) => {
    const v = (s ?? "").trim();
    return v.length > 0 ? v : undefined;
  };
  return {
    tipo: f.tipo,
    status: f.status,
    utm_campaign: t(f.utm_campaign),
    since: t(f.since),
    until: t(f.until),
    limit: f.limit,
    offset: f.offset,
  };
}

/* -------------------------------------------------------------------------- */
/*  Listagem paginada                                                          */
/* -------------------------------------------------------------------------- */
export async function listarLeads(filtros?: FiltrosLeads): Promise<LeadRow[]> {
  if (!dbHabilitado) return [];
  const f = norm(filtros);
  const limit = Math.min(Math.max(1, f.limit ?? 30), 200);
  const offset = Math.max(0, f.offset ?? 0);
  try {
    return await sql<LeadRow[]>`
      select id,
             tipo,
             nome,
             email,
             telefone,
             empresa_nome,
             cargo,
             colaboradores,
             conselho,
             mensagem,
             status,
             utm_source,
             utm_medium,
             utm_campaign,
             utm_content,
             utm_term,
             contatado_em::text as contatado_em,
             notas_internas,
             criado_em::text   as criado_em
      from public.leads_lp
      where (${f.tipo ?? null}::text is null or tipo = ${f.tipo ?? null})
        and (${f.status ?? null}::text is null or status = ${f.status ?? null})
        and (${f.utm_campaign ?? null}::text is null or utm_campaign = ${f.utm_campaign ?? null})
        and (${f.since ?? null}::text is null or criado_em >= (${f.since ?? null})::timestamptz)
        and (${f.until ?? null}::text is null or criado_em < ((${f.until ?? null})::date + 1)::timestamptz)
      order by criado_em desc
      limit ${limit}
      offset ${offset}
    `;
  } catch (e) {
    console.warn("[queries-leads] listarLeads falhou:", e);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/*  Count total (para paginação)                                               */
/* -------------------------------------------------------------------------- */
export async function contarLeads(filtros?: FiltrosLeads): Promise<number> {
  if (!dbHabilitado) return 0;
  const f = norm(filtros);
  try {
    const [r] = await sql<{ n: number }[]>`
      select count(*)::int as n
      from public.leads_lp
      where (${f.tipo ?? null}::text is null or tipo = ${f.tipo ?? null})
        and (${f.status ?? null}::text is null or status = ${f.status ?? null})
        and (${f.utm_campaign ?? null}::text is null or utm_campaign = ${f.utm_campaign ?? null})
        and (${f.since ?? null}::text is null or criado_em >= (${f.since ?? null})::timestamptz)
        and (${f.until ?? null}::text is null or criado_em < ((${f.until ?? null})::date + 1)::timestamptz)
    `;
    return r?.n ?? 0;
  } catch (e) {
    console.warn("[queries-leads] contarLeads falhou:", e);
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
/*  Resumo do funil — contadores por status                                    */
/* -------------------------------------------------------------------------- */
export async function resumoFunil(filtros?: FiltrosLeads): Promise<ResumoFunil> {
  if (!dbHabilitado) return RESUMO_VAZIO;
  // Resumo ignora filtro de status (queremos quantos há em CADA status).
  const f = { ...norm(filtros), status: undefined as LeadStatus | undefined };
  try {
    const rows = await sql<{ status: LeadStatus; n: number }[]>`
      select status, count(*)::int as n
      from public.leads_lp
      where (${f.tipo ?? null}::text is null or tipo = ${f.tipo ?? null})
        and (${f.utm_campaign ?? null}::text is null or utm_campaign = ${f.utm_campaign ?? null})
        and (${f.since ?? null}::text is null or criado_em >= (${f.since ?? null})::timestamptz)
        and (${f.until ?? null}::text is null or criado_em < ((${f.until ?? null})::date + 1)::timestamptz)
      group by status
    `;
    const r: ResumoFunil = { ...RESUMO_VAZIO };
    for (const row of rows) {
      if (row.status in r) r[row.status] = row.n;
      r.total += row.n;
    }
    return r;
  } catch (e) {
    console.warn("[queries-leads] resumoFunil falhou:", e);
    return RESUMO_VAZIO;
  }
}

/* -------------------------------------------------------------------------- */
/*  Atualização de status                                                      */
/* -------------------------------------------------------------------------- */
export interface AtualizarStatusEntrada {
  status: LeadStatus;
  notas?: string;
}

export async function atualizarStatusLead(
  id: string,
  entrada: AtualizarStatusEntrada,
): Promise<{ ok: boolean; row?: LeadRow }> {
  if (!dbHabilitado) return { ok: false };
  if (!STATUS_VALIDOS.includes(entrada.status)) return { ok: false };
  try {
    const contatado = entrada.status !== "novo" ? new Date() : null;
    const [row] = await sql<LeadRow[]>`
      update public.leads_lp
         set status = ${entrada.status},
             notas_internas = coalesce(${entrada.notas ?? null}, notas_internas),
             contatado_em = case
               when contatado_em is null and ${contatado as Date | null} is not null
                 then ${contatado as Date | null}
               else contatado_em
             end
       where id = ${id}
       returning id,
                 tipo,
                 nome,
                 email,
                 telefone,
                 empresa_nome,
                 cargo,
                 colaboradores,
                 conselho,
                 mensagem,
                 status,
                 utm_source,
                 utm_medium,
                 utm_campaign,
                 utm_content,
                 utm_term,
                 contatado_em::text as contatado_em,
                 notas_internas,
                 criado_em::text   as criado_em
    `;
    if (!row) return { ok: false };
    return { ok: true, row };
  } catch (e) {
    console.warn("[queries-leads] atualizarStatusLead falhou:", e);
    return { ok: false };
  }
}
