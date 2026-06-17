import "server-only";
import { z } from "zod";
import { sqlAdmin } from "@/lib/db";
import type { Papel } from "@/lib/auth";
import type { TipoNotificacao } from "@/lib/notify";

/**
 * Camada de LEITURA das notificações in-app (Onda 8 · Dev A).
 *
 * NÃO confundir com `lib/notify.ts` — aquele ESCREVE (persiste + despacha) na
 * trilha. Este aqui só LÊ/marca a tabela `public.notificacoes`, que é trilha de
 * observabilidade global (mistura empresa_id NULL e não-NULL), portanto acessada
 * SEMPRE via `sqlAdmin` (bypass de RLS) — mesma decisão documentada na mig 0020.
 *
 * O isolamento por tenant é feito AQUI, no SQL (WHERE empresa_id = ...), conforme
 * o papel:
 *   - admin  → vê TODAS as notificações (todas as empresas + as de empresa_id NULL),
 *              de todos os tipos (inclusive reset_senha).
 *   - sst    → vê SÓ as da sua empresa e SÓ os tipos relevantes ao gestor
 *              (risco_grave, dsar, generico). NUNCA reset_senha (é trilha de
 *              segurança de conta, não interessa ao painel da empresa). Nunca vê
 *              as de outra empresa nem as de empresa_id NULL.
 *   - clinica → não tem acesso (a API/página são gated sst|admin).
 *
 * Toda função recebe `papel` e (quando sst) escopa por `empresaId`. Inputs
 * validados com Zod.
 */

/* -------------------------------------------------------------------------- */
/*  Tipos visíveis ao SST                                                      */
/* -------------------------------------------------------------------------- */

/** Tipos que o gestor SST pode ver no painel (reset_senha fica de fora). */
export const TIPOS_SST: readonly TipoNotificacao[] = [
  "risco_grave",
  "dsar",
  "generico",
];

const TODOS_TIPOS: readonly TipoNotificacao[] = [
  "risco_grave",
  "dsar",
  "reset_senha",
  "generico",
];

/* -------------------------------------------------------------------------- */
/*  Tipos de saída                                                             */
/* -------------------------------------------------------------------------- */

export interface Notificacao {
  id: string;
  tipo: TipoNotificacao;
  empresa_id: string | null;
  titulo: string;
  corpo: string;
  canal: string | null;
  status: string;
  criado_em: string;
  lida_em: string | null;
}

interface RowDb {
  id: string;
  tipo: TipoNotificacao;
  empresa_id: string | null;
  titulo: string;
  corpo: string;
  canal: string | null;
  status: string;
  criado_em: string;
  lida_em: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Schemas                                                                    */
/* -------------------------------------------------------------------------- */

const PapelSchema = z.enum(["sst", "clinica", "admin"]);
const TipoSchema = z.enum(["risco_grave", "dsar", "reset_senha", "generico"]);

const ListarSchema = z
  .object({
    empresaId: z.string().trim().min(1).nullish(),
    papel: PapelSchema,
    tipos: z.array(TipoSchema).optional(),
    apenasNaoLidas: z.boolean().optional().default(false),
    limit: z.number().int().min(1).max(200).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
  })
  .strict();

export type ListarNotificacoesInput = z.input<typeof ListarSchema>;

const IdSchema = z.string().trim().uuid();

/* -------------------------------------------------------------------------- */
/*  Helpers de escopo por papel                                               */
/* -------------------------------------------------------------------------- */

/**
 * Resolve o conjunto efetivo de tipos visíveis conforme o papel e o filtro
 * opcional `tipos`. Para sst, intersecta com TIPOS_SST (nunca reset_senha).
 */
function tiposEfetivos(
  papel: Papel,
  filtro?: readonly TipoNotificacao[],
): TipoNotificacao[] {
  const permitidos = papel === "admin" ? TODOS_TIPOS : TIPOS_SST;
  if (!filtro || filtro.length === 0) return [...permitidos];
  return filtro.filter((t) => permitidos.includes(t));
}

function mapRow(r: RowDb): Notificacao {
  return {
    id: r.id,
    tipo: r.tipo,
    empresa_id: r.empresa_id,
    titulo: r.titulo,
    corpo: r.corpo,
    canal: r.canal,
    status: r.status,
    criado_em: r.criado_em,
    lida_em: r.lida_em,
  };
}

/* -------------------------------------------------------------------------- */
/*  Leitura                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lista notificações conforme o papel:
 *   - admin → todas (todas empresas + NULL); todos os tipos.
 *   - sst   → só da sua empresa; só TIPOS_SST (∩ filtro). Sem reset_senha.
 * Ordena por criado_em desc. Pagina com limit/offset.
 */
export async function listarNotificacoes(
  input: ListarNotificacoesInput,
): Promise<Notificacao[]> {
  const { empresaId, papel, tipos, apenasNaoLidas, limit, offset } =
    ListarSchema.parse(input);

  const tiposVis = tiposEfetivos(papel, tipos as TipoNotificacao[] | undefined);
  const escoparEmpresa = papel !== "admin";

  // sst SEM empresa → fail-closed (não deve acontecer; a sessão sempre tem empresa).
  if (escoparEmpresa && !empresaId) return [];

  // Aplica o filtro `tipo in (...)` quando: (a) papel restrito (sst — sempre
  // limita aos TIPOS_SST) ou (b) admin que passou um filtro explícito de tipos.
  // Para admin sem filtro, não há cláusula de tipo (vê tudo).
  const filtrarTipos = escoparEmpresa || (tipos != null && tipos.length > 0);
  // sst com filtro que zera os tipos permitidos → nada a listar.
  if (filtrarTipos && tiposVis.length === 0) return [];

  const rows = await sqlAdmin<RowDb[]>`
    select id, tipo, empresa_id, titulo, corpo, canal, status,
           criado_em::text as criado_em, lida_em::text as lida_em
      from public.notificacoes
     where 1 = 1
       ${escoparEmpresa ? sqlAdmin`and empresa_id = ${empresaId!}` : sqlAdmin``}
       ${filtrarTipos ? sqlAdmin`and tipo in ${sqlAdmin(tiposVis)}` : sqlAdmin``}
       ${apenasNaoLidas ? sqlAdmin`and lida_em is null` : sqlAdmin``}
     order by criado_em desc
     limit ${limit} offset ${offset}
  `;
  return rows.map(mapRow);
}

/**
 * Conta notificações NÃO LIDAS visíveis ao papel (mesmo escopo de
 * listarNotificacoes). Usado pelo sino do header e pelo painel.
 */
export async function contarNaoLidas(
  empresaId: string | null | undefined,
  papel: Papel,
): Promise<number> {
  PapelSchema.parse(papel);
  const tiposVis = tiposEfetivos(papel);
  const escoparEmpresa = papel !== "admin";
  if (escoparEmpresa && !empresaId) return 0;

  const [row] = await sqlAdmin<{ n: number }[]>`
    select count(*)::int as n
      from public.notificacoes
     where lida_em is null
       ${escoparEmpresa ? sqlAdmin`and empresa_id = ${empresaId!}` : sqlAdmin``}
       ${papel !== "admin" ? sqlAdmin`and tipo in ${sqlAdmin(tiposVis)}` : sqlAdmin``}
  `;
  return row?.n ?? 0;
}

/* -------------------------------------------------------------------------- */
/*  Escrita (marca de leitura)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Marca UMA notificação como lida (set lida_em = now()). Idempotente: se já
 * estava lida, mantém o lida_em original (coalesce). Retorna true se a linha
 * existe e está no escopo permitido.
 *
 * `escopoEmpresaId`: quando informado (papel sst), só marca se a notificação
 * pertencer àquela empresa — impede um sst marcar a de outro tenant. Para admin,
 * passe `undefined` (sem escopo).
 */
export async function marcarLida(
  id: string,
  escopoEmpresaId?: string | null,
): Promise<boolean> {
  const idOk = IdSchema.parse(id);
  // escopoEmpresaId definido == papel sst: além do tenant, restringe aos tipos
  // que o sst enxerga (TIPOS_SST, sem reset_senha) — coerência com a listagem.
  const rows = await sqlAdmin<{ id: string }[]>`
    update public.notificacoes
       set lida_em = coalesce(lida_em, now())
     where id = ${idOk}
       ${escopoEmpresaId ? sqlAdmin`and empresa_id = ${escopoEmpresaId}` : sqlAdmin``}
       ${escopoEmpresaId ? sqlAdmin`and tipo in ${sqlAdmin([...TIPOS_SST])}` : sqlAdmin``}
    returning id
  `;
  return rows.length > 0;
}

/**
 * Marca TODAS as não lidas visíveis ao papel como lidas. Para sst, só as da sua
 * empresa e dos tipos permitidos; para admin, todas as não lidas. Retorna a
 * quantidade marcada.
 */
export async function marcarTodasLidas(
  empresaId: string | null | undefined,
  papel: Papel,
): Promise<number> {
  PapelSchema.parse(papel);
  const tiposVis = tiposEfetivos(papel);
  const escoparEmpresa = papel !== "admin";
  if (escoparEmpresa && !empresaId) return 0;

  const rows = await sqlAdmin<{ id: string }[]>`
    update public.notificacoes
       set lida_em = now()
     where lida_em is null
       ${escoparEmpresa ? sqlAdmin`and empresa_id = ${empresaId!}` : sqlAdmin``}
       ${papel !== "admin" ? sqlAdmin`and tipo in ${sqlAdmin(tiposVis)}` : sqlAdmin``}
    returning id
  `;
  return rows.length;
}
