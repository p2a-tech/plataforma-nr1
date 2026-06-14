import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { sql, sqlAdmin } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";

/**
 * Campanha DRPS · Onda 5 (Dev B · §8 do BACKLOG_OKEBAMBO).
 *
 * Substitui o token determinístico HMAC + lookup O(n) da Onda 4 por uma tabela
 * persistente (`drps_campanha`) com:
 *   - token aleatório de alta entropia (16 bytes → 22 chars base64url),
 *   - expiração opcional (`expira_em`) + flag `ativo`,
 *   - identificador de ciclo (`ciclo`) usado pelo comparativo histórico (§8).
 *
 * Lookups por token são CROSS-TENANT por design — a página pública
 * `/r/drps/[token]` precisa descobrir a empresa-alvo antes de existir contexto
 * de tenant. Por isso `obterCampanhaPorToken` usa `sqlAdmin` (não `withEmpresa`).
 *
 * CRUD tenant-scoped (criar/listar/desativar) passa por `withEmpresa` + RLS.
 */

/* -------------------------------------------------------------------------- */
/*  Tipos + schemas                                                            */
/* -------------------------------------------------------------------------- */

export interface Campanha {
  id: string;
  empresa_id: string;
  instrumento_id: string | null;
  codigo: string;
  titulo: string;
  token: string;
  ciclo: string;
  ativo: boolean;
  expira_em: string | null;
  criado_em: string;
}

export interface CampanhaComMetricas extends Campanha {
  n_respostas: number;
}

export const NovaCampanhaSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9_-]+$/i, "use letras, números, hífen ou underscore"),
    titulo: z.string().trim().min(2).max(120),
    ciclo: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9_-]+$/i, "ciclo: letras/números/hífen/underscore"),
    instrumento_id: z.string().uuid().nullish(),
    expira_em: z.string().datetime().nullish(),
  })
  .strict();
export type NovaCampanha = z.infer<typeof NovaCampanhaSchema>;

/* -------------------------------------------------------------------------- */
/*  Geração de token                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Token criptograficamente seguro de 22 chars (base64url de 16 bytes).
 * Exposto para tests; aplicações normais devem chamar `criarCampanha`.
 */
export function gerarTokenCampanha(): string {
  return randomBytes(16).toString("base64url");
}

/* -------------------------------------------------------------------------- */
/*  CRUD tenant-scoped                                                         */
/* -------------------------------------------------------------------------- */

export interface ListarCampanhasOpts {
  ativos?: boolean;
  ciclo?: string;
  limit?: number;
}

/** Lista campanhas da empresa (default: todas; opcional: filtra ativas/ciclo). */
export async function listarCampanhas(
  empresaId: string,
  opts: ListarCampanhasOpts = {},
): Promise<CampanhaComMetricas[]> {
  return withEmpresa(empresaId, async () => {
    const lim = Math.min(Math.max(opts.limit ?? 50, 1), 500);
    const filtroAtivo = opts.ativos === undefined ? null : opts.ativos;
    const filtroCiclo = opts.ciclo ?? null;
    return sql<CampanhaComMetricas[]>`
      select c.id, c.empresa_id, c.instrumento_id, c.codigo, c.titulo,
             c.token, c.ciclo, c.ativo,
             c.expira_em::text as expira_em,
             c.criado_em::text as criado_em,
             coalesce((
               select count(*)::int
                 from public.drps_resposta r
                where r.campanha_id = c.id
             ), 0) as n_respostas
        from public.drps_campanha c
       where c.empresa_id = ${empresaId}
         and (${filtroAtivo}::bool is null or c.ativo = ${filtroAtivo}::bool)
         and (${filtroCiclo}::text is null or c.ciclo = ${filtroCiclo}::text)
       order by c.criado_em desc
       limit ${lim}
    `;
  });
}

/** Cria nova campanha. Token é gerado server-side (`gerarTokenCampanha`). */
export async function criarCampanha(
  empresaId: string,
  dados: NovaCampanha,
): Promise<Campanha> {
  return withEmpresa(empresaId, async () => {
    const token = gerarTokenCampanha();
    const [row] = await sql<Campanha[]>`
      insert into public.drps_campanha
        (empresa_id, instrumento_id, codigo, titulo, token, ciclo,
         ativo, expira_em)
      values
        (${empresaId}, ${dados.instrumento_id ?? null},
         ${dados.codigo}, ${dados.titulo}, ${token}, ${dados.ciclo},
         true, ${dados.expira_em ?? null})
      returning id, empresa_id, instrumento_id, codigo, titulo,
                token, ciclo, ativo,
                expira_em::text as expira_em,
                criado_em::text as criado_em
    `;
    return row;
  });
}

/** Desativa campanha (mantém histórico de respostas vinculadas). */
export async function desativarCampanha(
  empresaId: string,
  id: string,
): Promise<boolean> {
  return withEmpresa(empresaId, async () => {
    const rows = await sql<{ id: string }[]>`
      update public.drps_campanha
         set ativo = false
       where id = ${id} and empresa_id = ${empresaId}
       returning id
    `;
    return rows.length > 0;
  });
}

/** Reativa campanha (caso o SST queira retomar coleta). */
export async function reativarCampanha(
  empresaId: string,
  id: string,
): Promise<boolean> {
  return withEmpresa(empresaId, async () => {
    const rows = await sql<{ id: string }[]>`
      update public.drps_campanha
         set ativo = true
       where id = ${id} and empresa_id = ${empresaId}
       returning id
    `;
    return rows.length > 0;
  });
}

/* -------------------------------------------------------------------------- */
/*  Lookup cross-tenant (token → empresa)                                      */
/* -------------------------------------------------------------------------- */

export interface CampanhaResolvida {
  campanha_id: string;
  empresa_id: string;
  instrumento_id: string | null;
  ativo: boolean;
  expira_em: string | null;
}

/**
 * Resolve uma campanha por token. Cross-tenant por design — a página pública
 * precisa descobrir a empresa antes de ter escopo de tenant.
 *
 * Retorna `null` se o token não existir OU se a campanha estiver inativa ou
 * expirada — o filtro `ativo = true AND (expira_em IS NULL OR expira_em > now())`
 * fecha a janela de submissão em campanhas desativadas/vencidas direto no banco
 * (defesa em profundidade além de `campanhaAceitaRespostas`).
 */
export async function obterCampanhaPorToken(
  token: string,
): Promise<CampanhaResolvida | null> {
  const rows = await sqlAdmin<CampanhaResolvida[]>`
    select id as campanha_id, empresa_id, instrumento_id, ativo,
           expira_em::text as expira_em
      from public.drps_campanha
     where token = ${token}
       and ativo = true
       and (expira_em is null or expira_em > now())
     limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Pega a campanha ativa mais recente da empresa (cross-tenant — fallback
 * usado por `registrarResposta` quando o caller não tem campanha_id).
 */
export async function campanhaAtivaMaisRecente(
  empresaId: string,
): Promise<CampanhaResolvida | null> {
  const rows = await sqlAdmin<CampanhaResolvida[]>`
    select id as campanha_id, empresa_id, instrumento_id, ativo,
           expira_em::text as expira_em
      from public.drps_campanha
     where empresa_id = ${empresaId}
       and ativo = true
       and (expira_em is null or expira_em > now())
     order by criado_em desc
     limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Garante a existência de uma campanha "avulsa" para a empresa — usada como
 * fallback final quando NÃO há nenhuma campanha cadastrada. Idempotente.
 */
export async function garantirCampanhaAvulsa(
  empresaId: string,
  instrumentoId: string | null,
): Promise<CampanhaResolvida> {
  // Tenta pegar uma já existente (evita corrida).
  const existente = await sqlAdmin<CampanhaResolvida[]>`
    select id as campanha_id, empresa_id, instrumento_id, ativo,
           expira_em::text as expira_em
      from public.drps_campanha
     where empresa_id = ${empresaId} and codigo = 'avulso'
     limit 1
  `;
  if (existente[0]) return existente[0];

  const token = gerarTokenCampanha();
  const [row] = await sqlAdmin<CampanhaResolvida[]>`
    insert into public.drps_campanha
      (empresa_id, instrumento_id, codigo, titulo, token, ciclo,
       ativo, expira_em)
    values
      (${empresaId}, ${instrumentoId},
       'avulso', 'Avulso (sem campanha)', ${token}, 'avulso',
       true, null)
    on conflict (empresa_id, codigo) do update
       set ativo = true
    returning id as campanha_id, empresa_id, instrumento_id, ativo,
              expira_em::text as expira_em
  `;
  return row;
}

/** True se a campanha está ativa E (sem expiração OU expira_em > now). */
export function campanhaAceitaRespostas(c: CampanhaResolvida): boolean {
  if (!c.ativo) return false;
  if (c.expira_em) {
    const exp = new Date(c.expira_em).getTime();
    if (Number.isFinite(exp) && exp <= Date.now()) return false;
  }
  return true;
}
