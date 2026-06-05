import "server-only";
// Console Admin é cross-tenant por design — usa o cliente root (bypass de RLS).
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";

/**
 * Camada de leitura do Console Admin (P2A). SOMENTE leitura — agrega contadores
 * globais da plataforma a partir do Postgres. Toda função:
 *   - tenta agregar os dados reais;
 *   - se o DB estiver desabilitado ou der erro, devolve defaults seguros (zeros
 *     / listas vazias) — nunca quebra a renderização do painel.
 *
 * Diferente de `lib/queries.ts`, aqui NÃO há fallback para mock: o admin precisa
 * ver o estado real (ou vazio honesto) da plataforma.
 */

export interface AdminOverview {
  habilitado: boolean;
  clinicasTotal: number;
  clinicasAtivas: number;
  usuariosTotal: number;
  usuariosPorPapel: Record<string, number>;
  eventosAgregados: number;
  pulsoRespostas: number;
  assinaturasPgr: number;
  webhookAceitos: number;
  webhookRejeitados: number;
  ultimaAtividade: string | null;
}

export interface ClinicaRow {
  id: string;
  nome: string;
  cnpj: string | null;
  ativa: boolean;
  criada_em: string;
}

export interface UsuarioRow {
  email: string;
  nome: string | null;
  papel: string;
  clinica_id: string | null;
}

const OVERVIEW_VAZIO: AdminOverview = {
  habilitado: false,
  clinicasTotal: 0,
  clinicasAtivas: 0,
  usuariosTotal: 0,
  usuariosPorPapel: {},
  eventosAgregados: 0,
  pulsoRespostas: 0,
  assinaturasPgr: 0,
  webhookAceitos: 0,
  webhookRejeitados: 0,
  ultimaAtividade: null,
};

/** Maior timestamp entre eventos agregados e respostas de pulso. */
function maisRecente(...isos: (string | null)[]): string | null {
  const validos = isos.filter((x): x is string => Boolean(x));
  if (validos.length === 0) return null;
  return validos.reduce((a, b) => (new Date(a) >= new Date(b) ? a : b));
}

/** Contadores globais da plataforma para o painel de visão geral. */
export async function getAdminOverview(): Promise<AdminOverview> {
  if (!dbHabilitado) return OVERVIEW_VAZIO;
  try {
    const [contadores, papeis, webhook, atividade] = await Promise.all([
      sql<
        {
          clinicas_total: number;
          clinicas_ativas: number;
          usuarios_total: number;
          eventos: number;
          pulsos: number;
          assinaturas: number;
        }[]
      >`
        select
          (select count(*)::int from public.clinicas) as clinicas_total,
          (select count(*)::int from public.clinicas where ativa) as clinicas_ativas,
          (select count(*)::int from public.usuarios) as usuarios_total,
          (select count(*)::int from public.eventos_agregados) as eventos,
          (select count(*)::int from public.pulso_respostas) as pulsos,
          (select count(*)::int from public.pgr_assinaturas) as assinaturas
      `,
      sql<{ papel: string; n: number }[]>`
        select papel, count(*)::int as n from public.usuarios group by papel
      `,
      sql<{ aceitos: number; rejeitados: number }[]>`
        select
          count(*) filter (where resultado = 'aceito')::int as aceitos,
          count(*) filter (where resultado = 'rejeitado')::int as rejeitados
        from public.webhook_audit_log
      `,
      sql<{ ult_evento: string | null; ult_pulso: string | null; ult_webhook: string | null }[]>`
        select
          (select max(criado_em)::text from public.eventos_agregados) as ult_evento,
          (select max(respondido_em)::text from public.pulso_respostas) as ult_pulso,
          (select max(recebido_em)::text from public.webhook_audit_log) as ult_webhook
      `,
    ]);

    const c = contadores[0];
    const w = webhook[0];
    const a = atividade[0];
    const usuariosPorPapel: Record<string, number> = {};
    for (const r of papeis) usuariosPorPapel[r.papel] = r.n;

    return {
      habilitado: true,
      clinicasTotal: c?.clinicas_total ?? 0,
      clinicasAtivas: c?.clinicas_ativas ?? 0,
      usuariosTotal: c?.usuarios_total ?? 0,
      usuariosPorPapel,
      eventosAgregados: c?.eventos ?? 0,
      pulsoRespostas: c?.pulsos ?? 0,
      assinaturasPgr: c?.assinaturas ?? 0,
      webhookAceitos: w?.aceitos ?? 0,
      webhookRejeitados: w?.rejeitados ?? 0,
      ultimaAtividade: maisRecente(a?.ult_evento ?? null, a?.ult_pulso ?? null, a?.ult_webhook ?? null),
    };
  } catch (e) {
    console.warn("[admin-queries] getAdminOverview falhou:", e);
    return { ...OVERVIEW_VAZIO, habilitado: dbHabilitado };
  }
}

/** Lista de clínicas parceiras (tenants do webhook da clínica). */
export async function getClinicas(): Promise<ClinicaRow[]> {
  if (!dbHabilitado) return [];
  try {
    return await sql<ClinicaRow[]>`
      select id, nome, cnpj, ativa, criada_em::text as criada_em
      from public.clinicas
      order by criada_em desc
    `;
  } catch (e) {
    console.warn("[admin-queries] getClinicas falhou:", e);
    return [];
  }
}

/** Lista de usuários da plataforma (sem dados sensíveis: nunca senha_hash). */
export async function getUsuarios(): Promise<UsuarioRow[]> {
  if (!dbHabilitado) return [];
  try {
    return await sql<UsuarioRow[]>`
      select email, nome, papel, clinica_id
      from public.usuarios
      order by papel asc, criado_em asc
    `;
  } catch (e) {
    console.warn("[admin-queries] getUsuarios falhou:", e);
    return [];
  }
}
