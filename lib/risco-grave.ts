import "server-only";
import { sql } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";

/**
 * Protocolo de risco grave/iminente (E8 · NR-1).
 *
 * Por design NÃO armazena PII. O `marcador_anonimo` é um identificador opaco
 * (ex: `session_id_anon` do atendimento) que permite à clínica re-vincular o
 * caso no seu próprio sistema — a empresa só vê tipo/severidade/status.
 *
 * Todas as funções assumem que o caller já tem `empresaId` em mãos (via sessão
 * ou via clínica → empresa_id no insert público). RLS garante isolamento de
 * defesa em profundidade.
 */

export type TipoRisco =
  | "ideacao_suicida"
  | "violencia_iminente"
  | "surto_psiquico"
  | "outros";

export type StatusRisco = "aberto" | "em_atendimento" | "encerrado";

export interface EventoRiscoGrave {
  id: string;
  empresa_id: string;
  clinica_id: string | null;
  marcador_anonimo: string;
  tipo: TipoRisco;
  severidade: number;
  status: StatusRisco;
  escalonado_para: string | null;
  notas: string | null;
  criado_em: string;
  acionado_em: string | null;
  encerrado_em: string | null;
}

export interface NovoEvento {
  clinica_id?: string | null;
  marcador_anonimo: string;
  tipo: TipoRisco;
  severidade: number;
  escalonado_para?: string | null;
  notas?: string | null;
}

/** Lista eventos NÃO encerrados (aberto + em_atendimento) da empresa. */
export async function listarEventosAtivos(
  empresaId: string,
): Promise<EventoRiscoGrave[]> {
  return withEmpresa(empresaId, async () => {
    const rows = await sql<EventoRiscoGrave[]>`
      select id, empresa_id, clinica_id, marcador_anonimo, tipo, severidade,
             status, escalonado_para, notas,
             criado_em::text as criado_em,
             acionado_em::text as acionado_em,
             encerrado_em::text as encerrado_em
        from public.eventos_risco_grave
       where empresa_id = ${empresaId}
         and status in ('aberto','em_atendimento')
       order by severidade desc, criado_em desc
    `;
    return rows;
  });
}

/** Cria evento dentro do escopo da empresa. Idempotente por (empresa, marcador). */
export async function criarEvento(
  empresaId: string,
  dados: NovoEvento,
): Promise<EventoRiscoGrave> {
  return withEmpresa(empresaId, async () => {
    const [row] = await sql<EventoRiscoGrave[]>`
      insert into public.eventos_risco_grave
        (empresa_id, clinica_id, marcador_anonimo, tipo, severidade,
         escalonado_para, notas, acionado_em)
      values
        (${empresaId}, ${dados.clinica_id ?? null}, ${dados.marcador_anonimo},
         ${dados.tipo}, ${dados.severidade},
         ${dados.escalonado_para ?? null}, ${dados.notas ?? null}, now())
      returning id, empresa_id, clinica_id, marcador_anonimo, tipo, severidade,
                status, escalonado_para, notas,
                criado_em::text as criado_em,
                acionado_em::text as acionado_em,
                encerrado_em::text as encerrado_em
    `;
    return row;
  });
}

/** Encerra um evento. SST/admin marca como encerrado e anexa notas internas. */
export async function encerrarEvento(
  empresaId: string,
  id: string,
  notas?: string | null,
): Promise<EventoRiscoGrave | null> {
  return withEmpresa(empresaId, async () => {
    const [row] = await sql<EventoRiscoGrave[]>`
      update public.eventos_risco_grave
         set status = 'encerrado',
             encerrado_em = now(),
             notas = coalesce(${notas ?? null}, notas)
       where id = ${id}
         and empresa_id = ${empresaId}
       returning id, empresa_id, clinica_id, marcador_anonimo, tipo, severidade,
                 status, escalonado_para, notas,
                 criado_em::text as criado_em,
                 acionado_em::text as acionado_em,
                 encerrado_em::text as encerrado_em
    `;
    return row ?? null;
  });
}

export interface ResumoSeveridade {
  tipo: TipoRisco;
  abertos: number;
  em_atendimento: number;
  severidade_media: number;
}

/** Resumo por tipo de evento (apenas os não encerrados). Para cards no header. */
export async function resumoSeveridade(
  empresaId: string,
): Promise<ResumoSeveridade[]> {
  return withEmpresa(empresaId, async () => {
    const rows = await sql<{
      tipo: TipoRisco;
      abertos: number;
      em_atendimento: number;
      severidade_media: number | null;
    }[]>`
      select tipo,
             count(*) filter (where status = 'aberto')::int        as abertos,
             count(*) filter (where status = 'em_atendimento')::int as em_atendimento,
             avg(severidade)::float8                                as severidade_media
        from public.eventos_risco_grave
       where empresa_id = ${empresaId}
         and status in ('aberto','em_atendimento')
       group by tipo
       order by tipo
    `;
    return rows.map((r) => ({
      tipo: r.tipo,
      abertos: r.abertos,
      em_atendimento: r.em_atendimento,
      severidade_media: Number((r.severidade_media ?? 0).toFixed(1)),
    }));
  });
}
