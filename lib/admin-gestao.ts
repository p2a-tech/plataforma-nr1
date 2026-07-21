import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { fingerprint } from "@/lib/clinic-secrets";
// Gestão de empresas/usuários é cross-tenant por design (Console Admin da P2A).
// Usa o cliente root (bypass de RLS); o gate de papel 'admin' é feito na
// page/route que invoca estas funções. NUNCA expor sem checagem de papel.
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";

/**
 * Camada de leitura/escrita do Console Admin para onboarding de clientes
 * (Onda 6 · Dev A). Cobre empresas, usuários e clínicas.
 *
 * Convenções:
 *   - Inputs validados com Zod (.strict() nos schemas de mutação).
 *   - Senhas hasheadas com bcryptjs (bcrypt.hashSync(senha, 10)) — mesmo formato
 *     ($2a$) verificado por bcrypt.compare no login (lib/auth-handlers).
 *   - Leitura é defensiva: DB indisponível/erro → defaults vazios.
 *   - Mutação propaga erro tipado (ResultadoErro) para a API mapear status.
 *   - Nunca seleciona senha_hash nas listagens.
 */

export const PAPEIS_VALIDOS = ["sst", "clinica", "admin"] as const;
export type Papel = (typeof PAPEIS_VALIDOS)[number];

const BCRYPT_ROUNDS = 10;

/* -------------------------------------------------------------------------- */
/*  Tipos de linha                                                             */
/* -------------------------------------------------------------------------- */
export interface EmpresaRow {
  id: string;
  nome: string;
  cnpj: string | null;
  segmento: string | null;
  ativa: boolean;
  criada_em: string;
  usuarios_total: number;
  usuarios_ativos: number;
}

export interface UsuarioRow {
  id: string;
  email: string;
  nome: string | null;
  papel: string;
  empresa_id: string;
  empresa_nome: string | null;
  clinica_id: string | null;
  clinica_nome: string | null;
  ativo: boolean;
  criado_por: string | null;
  criado_em: string;
}

export interface ClinicaRow {
  id: string;
  nome: string;
  empresa_id: string;
  ativa: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Resultado tipado de mutação                                                */
/* -------------------------------------------------------------------------- */
export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; erro: ResultadoErro; detalhe?: string[] };

export type ResultadoErro =
  | "db_indisponivel"
  | "validacao"
  | "id_duplicado"
  | "email_duplicado"
  | "empresa_inexistente"
  | "clinica_obrigatoria"
  | "clinica_invalida"
  | "nao_encontrado"
  | "erro_interno";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Gera um slug de id de empresa a partir do nome + sufixo curto aleatório. */
export function gerarIdEmpresa(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (combining diacritical marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  const sufixo = Math.random().toString(36).slice(2, 6);
  const corpo = base.length > 0 ? base : "empresa";
  return `emp_${corpo}_${sufixo}`;
}

/** Gera uma senha temporária legível (sem caracteres ambíguos). */
export function gerarSenhaTemporaria(tamanho = 14): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < tamanho; i++) {
    s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return s;
}

/** Detecta violação de unique constraint do Postgres (code 23505). */
function isUniqueViolation(e: unknown): boolean {
  return Boolean(e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "23505");
}

/* -------------------------------------------------------------------------- */
/*  Schemas Zod                                                                 */
/* -------------------------------------------------------------------------- */
const idEmpresaSchema = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9_]+$/, "id deve conter apenas letras minúsculas, números e _");

export const criarEmpresaSchema = z
  .object({
    id: idEmpresaSchema.optional(),
    nome: z.string().trim().min(2).max(160),
    cnpj: z.string().trim().max(24).optional(),
    segmento: z.string().trim().max(120).optional(),
  })
  .strict();
export type CriarEmpresaInput = z.infer<typeof criarEmpresaSchema>;

export const atualizarEmpresaSchema = z
  .object({
    nome: z.string().trim().min(2).max(160).optional(),
    cnpj: z.string().trim().max(24).nullable().optional(),
    segmento: z.string().trim().max(120).nullable().optional(),
    ativa: z.boolean().optional(),
  })
  .strict();
export type AtualizarEmpresaInput = z.infer<typeof atualizarEmpresaSchema>;

export const criarUsuarioSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(160),
    nome: z.string().trim().min(2).max(120),
    papel: z.enum(PAPEIS_VALIDOS),
    empresa_id: z.string().trim().min(2).max(48),
    clinica_id: z.string().trim().max(48).optional().nullable(),
    senhaTemporaria: z.string().min(8).max(200),
  })
  .strict();
export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;

export const setUsuarioAtivoSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    ativo: z.boolean(),
  })
  .strict();

export const resetarSenhaSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    novaSenha: z.string().min(8).max(200),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/*  Filtros de listagem                                                         */
/* -------------------------------------------------------------------------- */
export interface FiltrosEmpresas {
  q?: string;
  ativa?: boolean;
}

export interface FiltrosUsuarios {
  empresa_id?: string;
  papel?: Papel;
  q?: string;
}

/* ========================================================================== */
/*  EMPRESAS                                                                    */
/* ========================================================================== */

/** Lista empresas + contagem de usuários (total e ativos). */
export async function listarEmpresas(filtros?: FiltrosEmpresas): Promise<EmpresaRow[]> {
  if (!dbHabilitado) return [];
  const q = filtros?.q?.trim() || null;
  const ativa = filtros?.ativa;
  try {
    return await sql<EmpresaRow[]>`
      select e.id,
             e.nome,
             e.cnpj,
             e.segmento,
             e.ativa,
             e.criada_em::text as criada_em,
             coalesce(u.total, 0)::int  as usuarios_total,
             coalesce(u.ativos, 0)::int as usuarios_ativos
        from public.empresas e
        left join lateral (
          select count(*)::int as total,
                 count(*) filter (where ativo)::int as ativos
            from public.usuarios uu
           where uu.empresa_id = e.id
        ) u on true
       where (${q}::text is null
              or e.nome ilike '%' || ${q} || '%'
              or e.id ilike '%' || ${q} || '%'
              or e.cnpj ilike '%' || ${q} || '%')
         and (${ativa ?? null}::boolean is null or e.ativa = ${ativa ?? null})
       order by e.criada_em desc
    `;
  } catch (e) {
    console.warn("[admin-gestao] listarEmpresas falhou:", e);
    return [];
  }
}

/** Busca uma empresa por id (ou null). */
export async function obterEmpresa(id: string): Promise<EmpresaRow | null> {
  if (!dbHabilitado) return null;
  const empresas = await listarEmpresas();
  return empresas.find((e) => e.id === id) ?? null;
}

/** Cria empresa. Gera id slug se não vier; trata id duplicado. */
export async function criarEmpresa(input: CriarEmpresaInput): Promise<Resultado<EmpresaRow>> {
  if (!dbHabilitado) return { ok: false, erro: "db_indisponivel" };

  const parsed = criarEmpresaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "validacao", detalhe: parsed.error.issues.map((i) => i.message) };
  }
  const { nome, cnpj, segmento } = parsed.data;
  const id = parsed.data.id?.trim() || gerarIdEmpresa(nome);

  try {
    const [row] = await sql<{ id: string }[]>`
      insert into public.empresas (id, nome, cnpj, segmento, ativa)
      values (${id}, ${nome}, ${cnpj ?? null}, ${segmento ?? null}, true)
      on conflict (id) do nothing
      returning id
    `;
    if (!row) {
      // id já existia → conflito.
      return { ok: false, erro: "id_duplicado", detalhe: [`Já existe empresa com id '${id}'.`] };
    }
    const criada = await obterEmpresa(row.id);
    if (!criada) return { ok: false, erro: "erro_interno" };
    return { ok: true, data: criada };
  } catch (e) {
    console.warn("[admin-gestao] criarEmpresa falhou:", e);
    return { ok: false, erro: "erro_interno" };
  }
}

/** Atualiza campos da empresa (parcial). */
export async function atualizarEmpresa(
  id: string,
  dados: AtualizarEmpresaInput,
): Promise<Resultado<EmpresaRow>> {
  if (!dbHabilitado) return { ok: false, erro: "db_indisponivel" };

  const parsed = atualizarEmpresaSchema.safeParse(dados);
  if (!parsed.success) {
    return { ok: false, erro: "validacao", detalhe: parsed.error.issues.map((i) => i.message) };
  }
  const d = parsed.data;
  try {
    // COALESCE só atualiza colunas presentes; sentinela undefined → null evita
    // sobrescrever com null indevido (exceto cnpj/segmento que aceitam null).
    const [row] = await sql<{ id: string }[]>`
      update public.empresas set
        nome     = coalesce(${d.nome ?? null}, nome),
        cnpj     = ${d.cnpj === undefined ? sql`cnpj` : (d.cnpj ?? null)},
        segmento = ${d.segmento === undefined ? sql`segmento` : (d.segmento ?? null)},
        ativa    = coalesce(${d.ativa ?? null}, ativa)
      where id = ${id}
      returning id
    `;
    if (!row) return { ok: false, erro: "nao_encontrado" };
    const atualizada = await obterEmpresa(row.id);
    if (!atualizada) return { ok: false, erro: "erro_interno" };
    return { ok: true, data: atualizada };
  } catch (e) {
    console.warn("[admin-gestao] atualizarEmpresa falhou:", e);
    return { ok: false, erro: "erro_interno" };
  }
}

/** Ativa/desativa empresa (atalho). */
export async function setEmpresaAtiva(id: string, ativa: boolean): Promise<Resultado<EmpresaRow>> {
  return atualizarEmpresa(id, { ativa });
}

/* ========================================================================== */
/*  USUÁRIOS                                                                    */
/* ========================================================================== */

/** Lista usuários com join de empresa/clínica (nunca expõe senha_hash). */
export async function listarUsuarios(filtros?: FiltrosUsuarios): Promise<UsuarioRow[]> {
  if (!dbHabilitado) return [];
  const empresaId = filtros?.empresa_id?.trim() || null;
  const papel = filtros?.papel || null;
  const q = filtros?.q?.trim() || null;
  try {
    return await sql<UsuarioRow[]>`
      select u.id::text as id,
             u.email,
             u.nome,
             u.papel,
             u.empresa_id,
             e.nome as empresa_nome,
             u.clinica_id,
             c.nome as clinica_nome,
             u.ativo,
             u.criado_por,
             u.criado_em::text as criado_em
        from public.usuarios u
        left join public.empresas e on e.id = u.empresa_id
        left join public.clinicas c on c.id = u.clinica_id
       where (${empresaId}::text is null or u.empresa_id = ${empresaId})
         and (${papel}::text is null or u.papel = ${papel})
         and (${q}::text is null
              or u.email ilike '%' || ${q} || '%'
              or u.nome  ilike '%' || ${q} || '%')
       order by u.criado_em desc
    `;
  } catch (e) {
    console.warn("[admin-gestao] listarUsuarios falhou:", e);
    return [];
  }
}

/** Busca um usuário por e-mail (ou null). */
export async function obterUsuario(email: string): Promise<UsuarioRow | null> {
  if (!dbHabilitado) return null;
  const alvo = email.trim().toLowerCase();
  try {
    const [row] = await sql<UsuarioRow[]>`
      select u.id::text as id,
             u.email,
             u.nome,
             u.papel,
             u.empresa_id,
             e.nome as empresa_nome,
             u.clinica_id,
             c.nome as clinica_nome,
             u.ativo,
             u.criado_por,
             u.criado_em::text as criado_em
        from public.usuarios u
        left join public.empresas e on e.id = u.empresa_id
        left join public.clinicas c on c.id = u.clinica_id
       where lower(u.email) = ${alvo}
       limit 1
    `;
    return row ?? null;
  } catch (e) {
    console.warn("[admin-gestao] obterUsuario falhou:", e);
    return null;
  }
}

/**
 * Cria usuário com hash bcrypt. Valida papel, existência da empresa e — para
 * papel 'clinica' — clínica obrigatória e pertencente à mesma empresa.
 * `criadoPor` é o e-mail do admin (trilha de onboarding).
 */
export async function criarUsuario(
  input: CriarUsuarioInput,
  criadoPor?: string | null,
): Promise<Resultado<UsuarioRow>> {
  if (!dbHabilitado) return { ok: false, erro: "db_indisponivel" };

  const parsed = criarUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "validacao", detalhe: parsed.error.issues.map((i) => i.message) };
  }
  const { email, nome, papel, empresa_id, senhaTemporaria } = parsed.data;
  const clinicaId = parsed.data.clinica_id?.trim() || null;

  // Clínica é obrigatória quando papel = clinica.
  if (papel === "clinica" && !clinicaId) {
    return { ok: false, erro: "clinica_obrigatoria" };
  }

  try {
    // Empresa precisa existir.
    const [emp] = await sql<{ id: string }[]>`
      select id from public.empresas where id = ${empresa_id} limit 1
    `;
    if (!emp) return { ok: false, erro: "empresa_inexistente" };

    // Se clínica informada, precisa existir e pertencer à mesma empresa.
    if (clinicaId) {
      const [cli] = await sql<{ id: string }[]>`
        select id from public.clinicas
         where id = ${clinicaId} and empresa_id = ${empresa_id}
         limit 1
      `;
      if (!cli) return { ok: false, erro: "clinica_invalida" };
    }

    const senhaHash = bcrypt.hashSync(senhaTemporaria, BCRYPT_ROUNDS);

    const [row] = await sql<{ email: string }[]>`
      insert into public.usuarios
        (email, senha_hash, nome, papel, empresa_id, clinica_id, ativo, criado_por)
      values
        (${email}, ${senhaHash}, ${nome}, ${papel}, ${empresa_id},
         ${clinicaId}, true, ${criadoPor ?? null})
      on conflict (email) do nothing
      returning email
    `;
    if (!row) {
      return { ok: false, erro: "email_duplicado", detalhe: [`Já existe usuário com e-mail '${email}'.`] };
    }
    const criado = await obterUsuario(row.email);
    if (!criado) return { ok: false, erro: "erro_interno" };
    return { ok: true, data: criado };
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, erro: "email_duplicado" };
    }
    console.warn("[admin-gestao] criarUsuario falhou:", e);
    return { ok: false, erro: "erro_interno" };
  }
}

/** Ativa/desativa usuário por e-mail. */
export async function setUsuarioAtivo(email: string, ativo: boolean): Promise<Resultado<UsuarioRow>> {
  if (!dbHabilitado) return { ok: false, erro: "db_indisponivel" };
  const parsed = setUsuarioAtivoSchema.safeParse({ email, ativo });
  if (!parsed.success) {
    return { ok: false, erro: "validacao", detalhe: parsed.error.issues.map((i) => i.message) };
  }
  try {
    const [row] = await sql<{ email: string }[]>`
      update public.usuarios
         set ativo = ${parsed.data.ativo}
       where lower(email) = ${parsed.data.email}
       returning email
    `;
    if (!row) return { ok: false, erro: "nao_encontrado" };
    const atualizado = await obterUsuario(row.email);
    if (!atualizado) return { ok: false, erro: "erro_interno" };
    return { ok: true, data: atualizado };
  } catch (e) {
    console.warn("[admin-gestao] setUsuarioAtivo falhou:", e);
    return { ok: false, erro: "erro_interno" };
  }
}

/** Reseta a senha de um usuário (hash bcrypt). */
export async function resetarSenhaUsuario(
  email: string,
  novaSenha: string,
): Promise<Resultado<UsuarioRow>> {
  if (!dbHabilitado) return { ok: false, erro: "db_indisponivel" };
  const parsed = resetarSenhaSchema.safeParse({ email, novaSenha });
  if (!parsed.success) {
    return { ok: false, erro: "validacao", detalhe: parsed.error.issues.map((i) => i.message) };
  }
  try {
    const senhaHash = bcrypt.hashSync(parsed.data.novaSenha, BCRYPT_ROUNDS);
    const [row] = await sql<{ email: string }[]>`
      update public.usuarios
         set senha_hash = ${senhaHash}
       where lower(email) = ${parsed.data.email}
       returning email
    `;
    if (!row) return { ok: false, erro: "nao_encontrado" };
    const atualizado = await obterUsuario(row.email);
    if (!atualizado) return { ok: false, erro: "erro_interno" };
    return { ok: true, data: atualizado };
  } catch (e) {
    console.warn("[admin-gestao] resetarSenhaUsuario falhou:", e);
    return { ok: false, erro: "erro_interno" };
  }
}

/* ========================================================================== */
/*  CLÍNICAS                                                                    */
/* ========================================================================== */

/** Lista clínicas (id, nome, empresa, ativa) — para associar usuário clínica. */
export async function listarClinicas(empresaId?: string): Promise<ClinicaRow[]> {
  if (!dbHabilitado) return [];
  const emp = empresaId?.trim() || null;
  try {
    return await sql<ClinicaRow[]>`
      select id, nome, empresa_id, ativa
        from public.clinicas
       where (${emp}::text is null or empresa_id = ${emp})
       order by nome asc
    `;
  } catch (e) {
    console.warn("[admin-gestao] listarClinicas falhou:", e);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/*  Clínicas (onboarding de parceiro)                                           */
/* -------------------------------------------------------------------------- */

/** Gera id slug de clínica (clin_<slug>_<sufixo>). */
export function gerarIdClinica(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  const sufixo = randomBytes(2).toString("hex");
  return `clin_${base.length > 0 ? base : "clinica"}_${sufixo}`;
}

/** Segredo HMAC do webhook da clínica (retornado UMA vez; só o hash persiste). */
export function gerarSegredoClinica(): string {
  return randomBytes(32).toString("base64url");
}

const criarClinicaSchema = z
  .object({
    id: z.string().trim().min(2).max(48).optional(),
    nome: z.string().trim().min(2).max(160),
    cnpj: z.string().trim().max(20).optional().nullable(),
    empresa_id: z.string().trim().min(1).max(60),
    /** Opcional: se não vier, geramos. O cru NUNCA é persistido (só o sha256). */
    segredo: z.string().trim().min(16).max(200).optional(),
  })
  .strict();
export type CriarClinicaInput = z.input<typeof criarClinicaSchema>;

/**
 * Cria a clínica parceira. `clinicas.webhook_secret_hash` é NOT NULL e guarda
 * apenas o sha256 do segredo (mesmo `fingerprint` que o webhook valida) — o
 * segredo cru volta UMA vez na resposta para ser guardado no perímetro da
 * clínica (env/secret manager), e nunca mais é recuperável.
 */
export async function criarClinica(
  input: CriarClinicaInput,
): Promise<Resultado<ClinicaRow & { segredoWebhook: string }>> {
  if (!dbHabilitado) return { ok: false, erro: "db_indisponivel" };

  const parsed = criarClinicaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "validacao", detalhe: parsed.error.issues.map((i) => i.message) };
  }
  const { nome, cnpj, empresa_id } = parsed.data;
  const id = parsed.data.id?.trim() || gerarIdClinica(nome);
  const segredo = parsed.data.segredo?.trim() || gerarSegredoClinica();

  try {
    const [emp] = await sql<{ id: string }[]>`
      select id from public.empresas where id = ${empresa_id} limit 1
    `;
    if (!emp) return { ok: false, erro: "empresa_inexistente" };

    const [row] = await sql<{ id: string }[]>`
      insert into public.clinicas (id, nome, cnpj, webhook_secret_hash, empresa_id, ativa)
      values (${id}, ${nome}, ${cnpj ?? null}, ${fingerprint(segredo)}, ${empresa_id}, true)
      on conflict (id) do nothing
      returning id
    `;
    if (!row) {
      return { ok: false, erro: "id_duplicado", detalhe: [`Já existe clínica com id '${id}'.`] };
    }
    return {
      ok: true,
      data: { id, nome, empresa_id, ativa: true, segredoWebhook: segredo },
    };
  } catch (e) {
    console.warn("[admin-gestao] criarClinica falhou:", e);
    return { ok: false, erro: "erro_interno" };
  }
}

/** Ativa/desativa a clínica. */
export async function setClinicaAtiva(
  id: string,
  ativa: boolean,
): Promise<Resultado<ClinicaRow>> {
  if (!dbHabilitado) return { ok: false, erro: "db_indisponivel" };
  try {
    const [row] = await sql<ClinicaRow[]>`
      update public.clinicas set ativa = ${ativa}
       where id = ${id}
      returning id, nome, empresa_id, ativa
    `;
    if (!row) return { ok: false, erro: "nao_encontrado" };
    return { ok: true, data: row };
  } catch (e) {
    console.warn("[admin-gestao] setClinicaAtiva falhou:", e);
    return { ok: false, erro: "erro_interno" };
  }
}

/** Mapeia ResultadoErro → HTTP status para as rotas de API. */
export function statusDoErro(erro: ResultadoErro): number {
  switch (erro) {
    case "db_indisponivel":
      return 503;
    case "validacao":
      return 422;
    case "id_duplicado":
    case "email_duplicado":
      return 409;
    case "empresa_inexistente":
    case "clinica_obrigatoria":
    case "clinica_invalida":
      return 400;
    case "nao_encontrado":
      return 404;
    default:
      return 500;
  }
}
