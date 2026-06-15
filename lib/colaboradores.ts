import "server-only";
import { z } from "zod";
import { sql } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";

/**
 * Registro de colaboradores (quadro de RH) — eSocial S-2240 por CPF.
 *
 * DECISÃO DE PRIVACIDADE: esta tabela é dado de RH do EMPREGADOR (CPF, nome,
 * matrícula, setor, cargo), TOTALMENTE SEPARADA das respostas anônimas do DRPS
 * (`drps_resposta*`). Não há FK, join nem chave comum entre os dois mundos. O
 * risco é mapeado POR SETOR (perfil do inventário DRPS) e aplicado a cada CPF
 * daquele setor — isso NÃO liga ninguém a respostas individuais (a barreira de
 * anonimato/k-anonimato permanece intacta).
 *
 * - CPF é normalizado (só dígitos) no banco; formatado/MASCARADO na exibição.
 * - listarColaboradores mascara CPF por padrão; só o gerador de XML (S-2240)
 *   pode pedir o CPF cru (flag `cpfCru`).
 * - Multi-tenant via withEmpresa + RLS forced (migration 0022).
 */

/* -------------------------------------------------------------------------- */
/*  CPF — validação + normalização + máscara                                  */
/* -------------------------------------------------------------------------- */

/** Mantém só dígitos. */
export function normalizarCpf(cpf: string): string {
  return (cpf ?? "").replace(/\D/g, "");
}

/**
 * Valida CPF: 11 dígitos + dígitos verificadores (algoritmo da Receita).
 * Rejeita também as sequências repetidas (00000000000 etc.).
 */
export function cpfValido(cpf: string): boolean {
  const d = normalizarCpf(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // todos iguais

  const calcDv = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const dv1 = calcDv(d.slice(0, 9), 10);
  if (dv1 !== Number(d[9])) return false;
  const dv2 = calcDv(d.slice(0, 10), 11);
  if (dv2 !== Number(d[10])) return false;
  return true;
}

/**
 * Mascara o CPF para exibição: revela só os 2 últimos dígitos.
 * Ex.: "12345678912" → "***.***.***-12".
 */
export function mascararCpf(cpf: string): string {
  const d = normalizarCpf(cpf);
  if (d.length !== 11) return "***.***.***-**";
  return `***.***.***-${d.slice(9)}`;
}

/** Formata CPF cru (só p/ contextos autorizados, ex.: XML). 000.000.000-00 */
export function formatarCpf(cpf: string): string {
  const d = normalizarCpf(cpf);
  if (d.length !== 11) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/* -------------------------------------------------------------------------- */
/*  Tipos + schemas                                                            */
/* -------------------------------------------------------------------------- */

export interface Colaborador {
  id: string;
  empresa_id: string;
  /** CPF — mascarado por padrão; cru só quando `cpfCru=true`. */
  cpf: string;
  nome: string | null;
  matricula: string | null;
  setor: string;
  cargo: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string | null;
}

const ColaboradorBaseSchema = z.object({
  cpf: z
    .string()
    .trim()
    .min(11)
    .max(18)
    .refine((v) => cpfValido(v), { message: "CPF inválido" }),
  nome: z.string().trim().min(1).max(160).nullish(),
  matricula: z.string().trim().max(60).nullish(),
  setor: z.string().trim().min(1).max(120),
  cargo: z.string().trim().max(120).nullish(),
  ativo: z.boolean().optional().default(true),
});
export const NovoColaboradorSchema = ColaboradorBaseSchema.strict();
export type NovoColaborador = z.infer<typeof NovoColaboradorSchema>;

export const AtualizarColaboradorSchema = z
  .object({
    nome: z.string().trim().min(1).max(160).nullish(),
    matricula: z.string().trim().max(60).nullish(),
    setor: z.string().trim().min(1).max(120).optional(),
    cargo: z.string().trim().max(120).nullish(),
    ativo: z.boolean().optional(),
  })
  .strict();
export type AtualizarColaborador = z.infer<typeof AtualizarColaboradorSchema>;

/** Uma linha do importador (CSV/JSON). CPF/setor obrigatórios; resto opcional. */
export const LinhaImportSchema = ColaboradorBaseSchema.strict();
export type LinhaImport = z.infer<typeof LinhaImportSchema>;

export interface ResultadoImport {
  inseridos: number;
  atualizados: number;
  erros: Array<{ linha: number; cpf?: string; motivos: string[] }>;
}

interface FiltrosListagem {
  setor?: string | null;
  apenasAtivos?: boolean;
  /** Quando true, retorna o CPF CRU (só o gerador de XML deve usar). */
  cpfCru?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Mapeamento de linha → Colaborador (com/sem máscara)                        */
/* -------------------------------------------------------------------------- */

interface RowDb {
  id: string;
  empresa_id: string;
  cpf: string;
  nome: string | null;
  matricula: string | null;
  setor: string;
  cargo: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string | null;
}

function mapRow(r: RowDb, cpfCru: boolean): Colaborador {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    cpf: cpfCru ? r.cpf : mascararCpf(r.cpf),
    nome: r.nome,
    matricula: r.matricula,
    setor: r.setor,
    cargo: r.cargo,
    ativo: r.ativo,
    criado_em: r.criado_em,
    atualizado_em: r.atualizado_em,
  };
}

/* -------------------------------------------------------------------------- */
/*  Leitura                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lista colaboradores da empresa. CPF MASCARADO por padrão (LGPD/PII). Passe
 * `cpfCru: true` SOMENTE no gerador de XML do S-2240.
 */
export async function listarColaboradores(
  empresaId: string,
  filtros: FiltrosListagem = {},
): Promise<Colaborador[]> {
  const { setor = null, apenasAtivos = false, cpfCru = false } = filtros;
  return withEmpresa(empresaId, async () => {
    const rows = await sql<RowDb[]>`
      select id, empresa_id, cpf, nome, matricula, setor, cargo, ativo,
             criado_em::text as criado_em, atualizado_em::text as atualizado_em
        from public.colaborador_registro
       where empresa_id = ${empresaId}
         ${setor ? sql`and setor = ${setor}` : sql``}
         ${apenasAtivos ? sql`and ativo = true` : sql``}
       order by setor, nome nulls last, cpf
    `;
    return rows.map((r) => mapRow(r, cpfCru));
  });
}

/** Contagem de colaboradores ATIVOS por setor (para o dashboard de S-2240). */
export async function contarPorSetor(
  empresaId: string,
): Promise<Array<{ setor: string; total: number }>> {
  return withEmpresa(empresaId, async () => {
    const rows = await sql<{ setor: string; total: number }[]>`
      select setor, count(*)::int as total
        from public.colaborador_registro
       where empresa_id = ${empresaId} and ativo = true
       group by setor
       order by count(*) desc, setor
    `;
    return rows;
  });
}

/* -------------------------------------------------------------------------- */
/*  Escrita                                                                    */
/* -------------------------------------------------------------------------- */

/** Cria um colaborador. Lança em CPF duplicado (constraint) — capture na rota. */
export async function criarColaborador(
  empresaId: string,
  input: NovoColaborador,
): Promise<Colaborador> {
  const dados = NovoColaboradorSchema.parse(input);
  const cpf = normalizarCpf(dados.cpf);
  return withEmpresa(empresaId, async () => {
    const [row] = await sql<RowDb[]>`
      insert into public.colaborador_registro
        (empresa_id, cpf, nome, matricula, setor, cargo, ativo)
      values
        (${empresaId}, ${cpf}, ${dados.nome ?? null}, ${dados.matricula ?? null},
         ${dados.setor}, ${dados.cargo ?? null}, ${dados.ativo})
      returning id, empresa_id, cpf, nome, matricula, setor, cargo, ativo,
                criado_em::text as criado_em, atualizado_em::text as atualizado_em
    `;
    // Devolve mascarado (consumo na UI).
    return mapRow(row, false);
  });
}

/** Atualiza campos editáveis de um colaborador. Retorna null se não existir. */
export async function atualizarColaborador(
  empresaId: string,
  id: string,
  input: AtualizarColaborador,
): Promise<Colaborador | null> {
  const dados = AtualizarColaboradorSchema.parse(input);
  return withEmpresa(empresaId, async () => {
    const [row] = await sql<RowDb[]>`
      update public.colaborador_registro
         set nome = coalesce(${dados.nome ?? null}, nome),
             matricula = coalesce(${dados.matricula ?? null}, matricula),
             setor = coalesce(${dados.setor ?? null}, setor),
             cargo = coalesce(${dados.cargo ?? null}, cargo),
             ativo = coalesce(${dados.ativo ?? null}, ativo),
             atualizado_em = now()
       where empresa_id = ${empresaId} and id = ${id}
      returning id, empresa_id, cpf, nome, matricula, setor, cargo, ativo,
                criado_em::text as criado_em, atualizado_em::text as atualizado_em
    `;
    return row ? mapRow(row, false) : null;
  });
}

/** Liga/desliga um colaborador (sem deletar — mantém histórico). */
export async function setAtivo(
  empresaId: string,
  id: string,
  ativo: boolean,
): Promise<Colaborador | null> {
  return withEmpresa(empresaId, async () => {
    const [row] = await sql<RowDb[]>`
      update public.colaborador_registro
         set ativo = ${ativo}, atualizado_em = now()
       where empresa_id = ${empresaId} and id = ${id}
      returning id, empresa_id, cpf, nome, matricula, setor, cargo, ativo,
                criado_em::text as criado_em, atualizado_em::text as atualizado_em
    `;
    return row ? mapRow(row, false) : null;
  });
}

/**
 * Importa colaboradores em lote (upsert por (empresa_id, cpf)). Valida cada
 * linha; linhas inválidas entram em `erros[]` (não abortam o lote). Linha com
 * CPF já existente é ATUALIZADA (nome/matrícula/setor/cargo/ativo); CPF novo é
 * INSERIDO. Retorna {inseridos, atualizados, erros[]}.
 */
export async function importarColaboradores(
  empresaId: string,
  linhas: unknown[],
): Promise<ResultadoImport> {
  const erros: ResultadoImport["erros"] = [];
  // Valida + normaliza cada linha; deduplica por CPF (último vence) p/ não
  // disparar duas vezes o ON CONFLICT no mesmo lote.
  const validas = new Map<string, LinhaImport>();

  linhas.forEach((bruta, idx) => {
    const linhaNum = idx + 1;
    const parsed = LinhaImportSchema.safeParse(bruta);
    if (!parsed.success) {
      erros.push({
        linha: linhaNum,
        cpf:
          typeof (bruta as { cpf?: unknown })?.cpf === "string"
            ? ((bruta as { cpf: string }).cpf)
            : undefined,
        motivos: parsed.error.issues.map((i) =>
          i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
        ),
      });
      return;
    }
    const cpf = normalizarCpf(parsed.data.cpf);
    validas.set(cpf, { ...parsed.data, cpf });
  });

  if (validas.size === 0) {
    return { inseridos: 0, atualizados: 0, erros };
  }

  let inseridos = 0;
  let atualizados = 0;

  await withEmpresa(empresaId, async () => {
    for (const [cpf, dados] of validas) {
      // `xmax = 0` no RETURNING distingue INSERT (0) de UPDATE (≠0).
      const [row] = await sql<{ inserido: boolean }[]>`
        insert into public.colaborador_registro
          (empresa_id, cpf, nome, matricula, setor, cargo, ativo)
        values
          (${empresaId}, ${cpf}, ${dados.nome ?? null}, ${dados.matricula ?? null},
           ${dados.setor}, ${dados.cargo ?? null}, ${dados.ativo})
        on conflict (empresa_id, cpf) do update
          set nome = excluded.nome,
              matricula = excluded.matricula,
              setor = excluded.setor,
              cargo = excluded.cargo,
              ativo = excluded.ativo,
              atualizado_em = now()
        returning (xmax = 0) as inserido
      `;
      if (row?.inserido) inseridos++;
      else atualizados++;
    }
  });

  return { inseridos, atualizados, erros };
}
