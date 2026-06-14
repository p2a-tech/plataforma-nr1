import "server-only";
import { sqlAdmin, sql, dbHabilitado } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";

/**
 * DSAR — pedidos de titular (LGPD arts. 18-22).
 *
 * Visão por papel:
 *  - admin: lista cross-tenant via sqlAdmin (vê inclusive pedidos com
 *    empresa_id null, ainda não classificados).
 *  - sst:   só vê pedidos da própria empresa (RLS), via withEmpresa + sql.
 *
 * `atualizarStatus` SEMPRE via sqlAdmin: depois de classificar o pedido o
 * operador pode precisar marcar `empresa_id`, e a transição "null → minha
 * empresa" não passaria pelo RLS (o WITH CHECK exigiria `app.empresa_id = X`
 * já desde a versão antiga da linha). Bypass controlado, escrita auditada.
 */

export type DsarStatus = "recebido" | "em_analise" | "atendido" | "rejeitado";

export type DsarTipo =
  | "acesso"
  | "exclusao"
  | "correcao"
  | "portabilidade"
  | "revogacao_consentimento"
  | "oposicao";

export interface DsarPedido {
  id: string;
  empresa_id: string | null;
  email_titular: string;
  tipo: DsarTipo;
  justificativa: string | null;
  status: DsarStatus;
  resposta: string | null;
  criado_em: Date;
  atendido_em: Date | null;
  atendido_por: string | null;
}

export interface ListarOpts {
  papel: "admin" | "sst";
  empresaId: string;
  status?: DsarStatus;
  limite?: number;
}

export async function listarPedidos(opts: ListarOpts): Promise<DsarPedido[]> {
  if (!dbHabilitado) return [];
  const limite = Math.min(opts.limite ?? 100, 500);

  // Admin: cross-tenant + inclui pedidos sem empresa (null) — fila de triagem.
  if (opts.papel === "admin") {
    const rows = await sqlAdmin<DsarPedido[]>`
      select id, empresa_id, email_titular, tipo, justificativa, status,
             resposta, criado_em, atendido_em, atendido_por
      from public.dsar_pedidos
      ${opts.status ? sqlAdmin`where status = ${opts.status}` : sqlAdmin``}
      order by
        case status when 'recebido' then 0 when 'em_analise' then 1 else 2 end,
        criado_em desc
      limit ${limite}
    `;
    return rows;
  }

  // SST: escopo da própria empresa via RLS.
  return withEmpresa(opts.empresaId, async () => {
    const rows = await sql<DsarPedido[]>`
      select id, empresa_id, email_titular, tipo, justificativa, status,
             resposta, criado_em, atendido_em, atendido_por
      from public.dsar_pedidos
      ${opts.status ? sql`where status = ${opts.status}` : sql``}
      order by
        case status when 'recebido' then 0 when 'em_analise' then 1 else 2 end,
        criado_em desc
      limit ${limite}
    `;
    return rows;
  });
}

export interface AtualizarParams {
  id: string;
  status: DsarStatus;
  resposta?: string | null;
  atendidoPor: string;
  /** Quando informado, associa o pedido a uma empresa (triagem por admin). */
  empresaId?: string | null;
  /**
   * Escopo de tenant do caller (Onda 3 · fix cross-tenant).
   *
   * - `undefined` → caller admin: UPDATE sem filtro de empresa (comportamento
   *   legado, necessário para triagem cross-tenant).
   * - `string`    → caller SST: UPDATE só pega linhas com
   *   `empresa_id IS NULL` (fila de triagem ainda não classificada) ou
   *   `empresa_id = escopoEmpresaId` (pedidos da própria empresa). Bloqueia
   *   um SST da empresa A de mutar pedido da empresa B mesmo que descubra o
   *   UUID na URL/HTML.
   *
   * Por que ainda `sqlAdmin`? A transição "empresa_id null → minha empresa"
   * (classificação) não passa pelo `WITH CHECK` do RLS, que exigiria
   * `app.empresa_id = X` na linha ANTIGA. Bypass intencional, escrita auditada.
   */
  escopoEmpresaId?: string | null;
}

export type AtualizarResultado =
  | { ok: true; pedido: DsarPedido }
  | { ok: false; motivo: "nao_encontrado_ou_fora_de_escopo" | "db_indisponivel" };

export async function atualizarStatus(
  p: AtualizarParams,
): Promise<AtualizarResultado> {
  if (!dbHabilitado) return { ok: false, motivo: "db_indisponivel" };
  const concluiu = p.status === "atendido" || p.status === "rejeitado";
  const escopo = p.escopoEmpresaId;

  // Quando o caller é SST (escopo definido), filtramos no WHERE para impedir
  // que um SST da empresa A mute pedido da empresa B. Pedidos sem empresa
  // (fila de triagem) também são editáveis pelo SST — neste momento ele
  // está classificando e associando ao próprio tenant.
  const [row] = await sqlAdmin<DsarPedido[]>`
    update public.dsar_pedidos
       set status = ${p.status},
           resposta = ${p.resposta ?? null},
           atendido_por = ${p.atendidoPor},
           atendido_em = ${concluiu ? new Date() : null},
           empresa_id = coalesce(${p.empresaId ?? null}, empresa_id)
     where id = ${p.id}
       ${
         escopo === undefined
           ? sqlAdmin``
           : sqlAdmin`and (empresa_id is null or empresa_id = ${escopo})`
       }
     returning id, empresa_id, email_titular, tipo, justificativa, status,
               resposta, criado_em, atendido_em, atendido_por
  `;
  if (!row) {
    return { ok: false, motivo: "nao_encontrado_ou_fora_de_escopo" };
  }
  return { ok: true, pedido: row };
}

/** Conta pedidos abertos (recebido + em_análise) — usado no SLA da página. */
export async function contarPedidosAbertos(opts: {
  papel: "admin" | "sst";
  empresaId: string;
}): Promise<{ total: number; vencidos15d: number }> {
  if (!dbHabilitado) return { total: 0, vencidos15d: 0 };

  const run = async (client: typeof sqlAdmin) => {
    const [a] = await client<{ total: number; vencidos15d: number }[]>`
      select
        count(*)::int as total,
        count(*) filter (where criado_em < now() - interval '15 days')::int as vencidos15d
      from public.dsar_pedidos
      where status in ('recebido','em_analise')
    `;
    return a ?? { total: 0, vencidos15d: 0 };
  };

  if (opts.papel === "admin") return run(sqlAdmin);
  return withEmpresa(opts.empresaId, () => run(sql as unknown as typeof sqlAdmin));
}
