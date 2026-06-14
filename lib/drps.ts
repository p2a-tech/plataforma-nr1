import "server-only";
import { createHmac, createHash } from "node:crypto";
import { z } from "zod";
import { sql, sqlAdmin } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";
import {
  obterCampanhaPorToken,
  campanhaAtivaMaisRecente,
  garantirCampanhaAvulsa,
  campanhaAceitaRespostas,
} from "@/lib/drps-campanha";

/**
 * DRPS — Diagnóstico de Riscos Psicossociais (NR-1).
 *
 * Tudo aqui é anônimo por construção: a única coisa que identifica um
 * colaborador é o `marcador_anonimo` (hash opaco), usado apenas para
 * idempotência. Sem PII (email/CPF/telefone) em momento algum.
 *
 * ── Resolução de token (Onda 5) ──
 * O token agora vem de `drps_campanha.token` (16 bytes b64url, persistente,
 * com expiração e suporte a múltiplos ciclos). Substituiu o HMAC determinístico
 * + força bruta O(n) sobre `empresas` da Onda 4.
 *
 * Mantemos o atalho de dev `demo-token-<empresaId>` GATED por NODE_ENV.
 * Mantemos `tokenDeCampanha(empresaId)` (HMAC determinístico) como utilitário
 * legado — não é mais a fonte de verdade da resolução, mas continua sendo
 * aceito quando bater com um token persistido (compatibilidade com testes/
 * scripts que ainda usam a derivação).
 */

/* -------------------------------------------------------------------------- */
/*  Tipos e schemas                                                            */
/* -------------------------------------------------------------------------- */

export type TipoPergunta =
  | "demografia"
  | "likert5_inverso"
  | "likert3_freq"
  | "impacto4"
  | "esgotamento5"
  | "multi_choice"
  | "texto";

export interface Instrumento {
  id: string;
  empresa_id: string | null;
  codigo: string;
  titulo: string;
  descricao: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface Pergunta {
  id: string;
  instrumento_id: string;
  ordem: number;
  codigo: string;
  enunciado: string;
  tipo: TipoPergunta;
  peso: number;
  dim_id: string | null;
  opcoes: Opcao[];
}

export interface Opcao {
  id: string;
  ordem: number;
  label: string;
  valor: number | null;
}

/* -------------------------------------------------------------------------- */
/*  Token determinístico                                                       */
/* -------------------------------------------------------------------------- */

function getAuthSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET ausente em produção (fail-closed).");
  }
  return "dev-auth-secret-trocar-em-producao";
}

/**
 * Token HMAC determinístico (legado · Onda 4).
 *
 * Mantido como utilitário: alguns testes/scripts derivam o token a partir
 * do empresaId. NÃO é mais a fonte de verdade da resolução pública — agora
 * o lookup é direto em `drps_campanha.token`.
 */
export function tokenDeCampanha(empresaId: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(`${empresaId}:drps`)
    .digest("hex")
    .slice(0, 24);
}

/**
 * Resolve `empresaId` a partir do token público:
 *   1) Atalho demo `demo-token-<empresaId>` (gated por NODE_ENV).
 *   2) Lookup direto em `drps_campanha.token` (Onda 5).
 *
 * Retorna apenas o `empresaId` para compatibilidade com a API existente.
 * Quem precisa de mais info (campanha_id, instrumento_id) deve chamar
 * `resolverCampanhaPorToken` abaixo.
 */
export async function resolverEmpresaPorToken(
  token: string,
): Promise<string | null> {
  const r = await resolverCampanhaPorToken(token);
  return r?.empresa_id ?? null;
}

/**
 * Resolve campanha completa a partir do token. Usado por `/api/drps/responder`
 * para conhecer `campanha_id` e `instrumento_id` num único lookup.
 */
export async function resolverCampanhaPorToken(
  token: string,
): Promise<{
  empresa_id: string;
  campanha_id: string | null;
  instrumento_id: string | null;
} | null> {
  // 1) Atalho demo (dev): `demo-token-<empresaId>`
  //    Fail-closed em produção — IDs de empresa são humano-legíveis (ex.:
  //    `emp_acme`), então sem gate um atacante poderia floodar respostas DRPS
  //    falsas. Em prod, o atalho é desativado e só o token persistido é aceito.
  if (token.startsWith("demo-token-")) {
    if (process.env.NODE_ENV === "production") return null;
    const empresaId = token.slice("demo-token-".length);
    if (!empresaId) return null;
    const existe = await empresaExiste(empresaId);
    if (!existe) return null;
    // Para o demo, deixamos campanha_id null — fallback de `registrarResposta`
    // pegará a ativa mais recente (ou cria 'Avulso').
    return { empresa_id: existe, campanha_id: null, instrumento_id: null };
  }

  // 2) Lookup em `drps_campanha.token` (Onda 5).
  const camp = await obterCampanhaPorToken(token);
  if (!camp) return null;
  // Campanha INATIVA / EXPIRADA → recusa coleta de respostas.
  if (!campanhaAceitaRespostas(camp)) return null;
  return {
    empresa_id: camp.empresa_id,
    campanha_id: camp.campanha_id,
    instrumento_id: camp.instrumento_id,
  };
}

async function empresaExiste(empresaId: string): Promise<string | null> {
  const rows = await sqlAdmin<{ id: string }[]>`
    select id from public.empresas where id = ${empresaId} limit 1
  `;
  return rows[0]?.id ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Listagem de instrumentos + perguntas                                       */
/* -------------------------------------------------------------------------- */

/** Globais + da empresa, todos ativos. */
export async function listarInstrumentosAtivos(
  empresaId: string,
): Promise<Instrumento[]> {
  return withEmpresa(empresaId, async () => {
    return sql<Instrumento[]>`
      select id, empresa_id, codigo, titulo, descricao, ativo,
             criado_em::text as criado_em
        from public.drps_instrumento
       where ativo = true
         and (empresa_id is null or empresa_id = ${empresaId})
       order by empresa_id nulls last, criado_em desc
    `;
  });
}

/** Carrega um instrumento (com perguntas + opções) por id. Cross-tenant — usa
 *  sqlAdmin porque a página pública precisa ler antes de ter empresa_id em
 *  escopo de RLS. Templates globais (empresa_id NULL) só.
 */
export async function carregarInstrumentoComPerguntas(
  instrumentoId: string,
): Promise<{ instrumento: Instrumento; perguntas: Pergunta[] } | null> {
  const [inst] = await sqlAdmin<Instrumento[]>`
    select id, empresa_id, codigo, titulo, descricao, ativo,
           criado_em::text as criado_em
      from public.drps_instrumento
     where id = ${instrumentoId} and ativo = true
     limit 1
  `;
  if (!inst) return null;

  const perguntas = await sqlAdmin<Omit<Pergunta, "opcoes">[]>`
    select id, instrumento_id, ordem, codigo, enunciado, tipo, peso::float8 as peso, dim_id
      from public.drps_pergunta
     where instrumento_id = ${instrumentoId}
     order by ordem
  `;

  const opcoes = await sqlAdmin<(Opcao & { pergunta_id: string })[]>`
    select o.id, o.pergunta_id, o.ordem, o.label, o.valor
      from public.drps_opcao o
      join public.drps_pergunta p on p.id = o.pergunta_id
     where p.instrumento_id = ${instrumentoId}
     order by o.pergunta_id, o.ordem
  `;

  const porPergunta = new Map<string, Opcao[]>();
  for (const o of opcoes) {
    const arr = porPergunta.get(o.pergunta_id) ?? [];
    arr.push({ id: o.id, ordem: o.ordem, label: o.label, valor: o.valor });
    porPergunta.set(o.pergunta_id, arr);
  }

  return {
    instrumento: inst,
    perguntas: perguntas.map((p) => ({
      ...p,
      opcoes: porPergunta.get(p.id) ?? [],
    })),
  };
}

/** Conveniência: pega o template Okêbambo global. */
export async function carregarTemplateOkebambo(): Promise<{
  instrumento: Instrumento;
  perguntas: Pergunta[];
} | null> {
  const [inst] = await sqlAdmin<{ id: string }[]>`
    select id from public.drps_instrumento
     where empresa_id is null and codigo = 'okebambo_v1' and ativo = true
     limit 1
  `;
  if (!inst) return null;
  return carregarInstrumentoComPerguntas(inst.id);
}

/* -------------------------------------------------------------------------- */
/*  Schema Zod da resposta (validação)                                         */
/* -------------------------------------------------------------------------- */

export const RespostaItem = z
  .object({
    pergunta_codigo: z.string().trim().min(1).max(20),
    valor_int: z.number().int().min(0).max(10).nullish(),
    valor_texto: z.string().trim().max(2000).nullish(),
    opcoes_ids: z.array(z.string().uuid()).max(20).optional(),
  })
  .strict();
export type RespostaItem = z.infer<typeof RespostaItem>;

export const NovaRespostaDRPS = z
  .object({
    marcador_anonimo: z.string().trim().min(8).max(80),
    setor: z.string().trim().max(80).nullish(),
    funcao: z.string().trim().max(80).nullish(),
    tempo_empresa: z.string().trim().max(40).nullish(),
    forma_atuacao: z.string().trim().max(40).nullish(),
    canal: z.enum(["web", "whatsapp", "app", "totem"]).default("web"),
    respostas: z.array(RespostaItem).min(1).max(100),
  })
  .strict();
export type NovaRespostaDRPS = z.infer<typeof NovaRespostaDRPS>;

/* -------------------------------------------------------------------------- */
/*  Registrar resposta                                                         */
/* -------------------------------------------------------------------------- */

export interface RespostaResumo {
  id: string;
  empresa_id: string;
  instrumento_id: string;
  campanha_id: string | null;
  marcador_anonimo: string;
  setor: string | null;
  funcao: string | null;
  tempo_empresa: string | null;
  forma_atuacao: string | null;
  canal: string;
  respondido_em: string;
}

/**
 * Cria a resposta completa (drps_resposta + items + opções) numa transação
 * via withEmpresa — RLS garante isolamento estrito.
 *
 * `campanhaId` é OPCIONAL:
 *   - se fornecido, usa direto (caso comum: token público resolvido pela rota).
 *   - se ausente, busca a campanha ativa mais recente da empresa.
 *   - se não houver nenhuma campanha ativa, GARANTE uma "Avulso" como fallback
 *     (idempotente — não vaza pra UI; mantém invariante "toda resposta tem
 *     campanha", essencial pro histórico §8).
 */
export async function registrarResposta(
  empresaId: string,
  instrumentoId: string,
  dados: NovaRespostaDRPS,
  campanhaId?: string | null,
): Promise<RespostaResumo> {
  // Resolução de campanha ANTES de abrir a transação tenant (campanhaAtivaMaisRecente
  // e garantirCampanhaAvulsa usam sqlAdmin propositadamente — fallback global).
  let campIdResolvido: string | null = campanhaId ?? null;
  if (!campIdResolvido) {
    const ativa = await campanhaAtivaMaisRecente(empresaId);
    if (ativa) {
      campIdResolvido = ativa.campanha_id;
    } else {
      // Fallback: cria campanha 'Avulso' (idempotente).
      const avulsa = await garantirCampanhaAvulsa(empresaId, instrumentoId);
      campIdResolvido = avulsa.campanha_id;
    }
  }

  return withEmpresa(empresaId, async () => {
    // 1) Carrega o instrumento + perguntas para validar/mapear códigos.
    const perguntas = await sql<{ id: string; codigo: string; tipo: TipoPergunta }[]>`
      select id, codigo, tipo
        from public.drps_pergunta
       where instrumento_id = ${instrumentoId}
    `;
    if (perguntas.length === 0) {
      throw new Error("instrumento sem perguntas");
    }
    const byCodigo = new Map(perguntas.map((p) => [p.codigo, p]));

    // 2) Cria (ou recupera) a resposta — idempotência por (instrumento, marcador).
    const [resposta] = await sql<RespostaResumo[]>`
      insert into public.drps_resposta
        (empresa_id, instrumento_id, campanha_id, marcador_anonimo, setor, funcao,
         tempo_empresa, forma_atuacao, canal)
      values
        (${empresaId}, ${instrumentoId}, ${campIdResolvido},
         ${dados.marcador_anonimo},
         ${dados.setor ?? null}, ${dados.funcao ?? null},
         ${dados.tempo_empresa ?? null}, ${dados.forma_atuacao ?? null},
         ${dados.canal})
      on conflict (instrumento_id, marcador_anonimo) do update
         set respondido_em = excluded.respondido_em,
             campanha_id   = excluded.campanha_id,
             setor         = excluded.setor,
             funcao        = excluded.funcao,
             tempo_empresa = excluded.tempo_empresa,
             forma_atuacao = excluded.forma_atuacao,
             canal         = excluded.canal
      returning id, empresa_id, instrumento_id, campanha_id, marcador_anonimo,
                setor, funcao, tempo_empresa, forma_atuacao, canal,
                respondido_em::text as respondido_em
    `;

    // 3) Limpa itens/opções anteriores (re-envio recria tudo)
    await sql`delete from public.drps_resposta_item  where resposta_id = ${resposta.id}`;
    await sql`delete from public.drps_resposta_opcao where resposta_id = ${resposta.id}`;

    // 4) Insere itens + opcoes
    for (const it of dados.respostas) {
      const p = byCodigo.get(it.pergunta_codigo);
      if (!p) continue; // perguntas desconhecidas são ignoradas silenciosamente

      // Validação tipo-específica (defesa em profundidade)
      const valorInt = sanitizarValorInt(p.tipo, it.valor_int);
      const valorTexto = sanitizarValorTexto(p.tipo, it.valor_texto);

      await sql`
        insert into public.drps_resposta_item
          (resposta_id, pergunta_id, valor_int, valor_texto)
        values (${resposta.id}, ${p.id}, ${valorInt}, ${valorTexto})
      `;

      if (p.tipo === "multi_choice" && it.opcoes_ids?.length) {
        for (const opcaoId of it.opcoes_ids) {
          await sql`
            insert into public.drps_resposta_opcao (resposta_id, opcao_id)
            values (${resposta.id}, ${opcaoId})
            on conflict do nothing
          `;
        }
      }
    }

    return resposta;
  });
}

function sanitizarValorInt(tipo: TipoPergunta, v?: number | null): number | null {
  if (v == null) return null;
  switch (tipo) {
    case "likert5_inverso":
    case "esgotamento5":
      return v >= 1 && v <= 5 ? v : null;
    case "likert3_freq":
      return v >= 1 && v <= 3 ? v : null;
    case "impacto4":
      return v >= 1 && v <= 4 ? v : null;
    case "demografia":
      return Number.isInteger(v) ? v : null;
    default:
      return null; // multi_choice/texto/etc não usam valor_int
  }
}

function sanitizarValorTexto(tipo: TipoPergunta, v?: string | null): string | null {
  if (v == null) return null;
  if (tipo === "texto" || tipo === "demografia" || tipo === "multi_choice") {
    const t = v.trim();
    return t.length === 0 ? null : t.slice(0, 2000);
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Listagem de respostas (cards de adesão)                                    */
/* -------------------------------------------------------------------------- */

export interface FiltroRespostas {
  instrumentoId?: string;
  desde?: string;     // ISO
  setor?: string;
  limit?: number;
}

export async function listarRespostas(
  empresaId: string,
  filtros: FiltroRespostas = {},
): Promise<RespostaResumo[]> {
  return withEmpresa(empresaId, async () => {
    const lim = Math.min(Math.max(filtros.limit ?? 50, 1), 500);
    const inst = filtros.instrumentoId ?? null;
    const desde = filtros.desde ?? null;
    const setor = filtros.setor ?? null;
    return sql<RespostaResumo[]>`
      select id, empresa_id, instrumento_id, campanha_id, marcador_anonimo,
             setor, funcao, tempo_empresa, forma_atuacao, canal,
             respondido_em::text as respondido_em
        from public.drps_resposta
       where empresa_id = ${empresaId}
         and (${inst}::uuid is null or instrumento_id = ${inst}::uuid)
         and (${desde}::timestamptz is null or respondido_em >= ${desde}::timestamptz)
         and (${setor}::text is null or setor = ${setor}::text)
       order by respondido_em desc
       limit ${lim}
    `;
  });
}

export interface AdesaoPorSetor {
  setor: string;
  respostas: number;
}

export async function adesaoPorSetor(
  empresaId: string,
  instrumentoId?: string,
): Promise<AdesaoPorSetor[]> {
  return withEmpresa(empresaId, async () => {
    const inst = instrumentoId ?? null;
    return sql<AdesaoPorSetor[]>`
      select coalesce(setor, '(não informado)') as setor,
             count(*)::int                      as respostas
        from public.drps_resposta
       where empresa_id = ${empresaId}
         and (${inst}::uuid is null or instrumento_id = ${inst}::uuid)
       group by 1
       order by respostas desc
    `;
  });
}

export interface ResumoAdesao {
  total: number;
  por_canal: { canal: string; n: number }[];
  por_forma_atuacao: { forma: string; n: number }[];
}

export async function resumoAdesao(
  empresaId: string,
  instrumentoId?: string,
): Promise<ResumoAdesao> {
  return withEmpresa(empresaId, async () => {
    const inst = instrumentoId ?? null;
    const [{ total }] = await sql<{ total: number }[]>`
      select count(*)::int as total
        from public.drps_resposta
       where empresa_id = ${empresaId}
         and (${inst}::uuid is null or instrumento_id = ${inst}::uuid)
    `;
    const por_canal = await sql<{ canal: string; n: number }[]>`
      select canal, count(*)::int as n
        from public.drps_resposta
       where empresa_id = ${empresaId}
         and (${inst}::uuid is null or instrumento_id = ${inst}::uuid)
       group by canal order by n desc
    `;
    const por_forma_atuacao = await sql<{ forma: string; n: number }[]>`
      select coalesce(forma_atuacao,'(não informado)') as forma, count(*)::int as n
        from public.drps_resposta
       where empresa_id = ${empresaId}
         and (${inst}::uuid is null or instrumento_id = ${inst}::uuid)
       group by 1 order by n desc
    `;
    return { total, por_canal, por_forma_atuacao };
  });
}

/* -------------------------------------------------------------------------- */
/*  Utilidades de marcador anônimo                                             */
/* -------------------------------------------------------------------------- */

/** Hash sha256 truncado pra usar como marcador anônimo (cliente envia o cru). */
export function marcadorAnonimoFromSeed(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}
