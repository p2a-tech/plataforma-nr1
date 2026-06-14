import "server-only";
import { createHash } from "node:crypto";
import {
  registrarResposta,
  carregarInstrumentoComPerguntas,
  type Pergunta,
  type Opcao,
} from "@/lib/drps";

/**
 * Importador DRPS · Google Forms CSV (Onda 5 · Dev C · §9 BACKLOG_OKEBAMBO).
 *
 * Fluxo:
 *   1) parseCsv(texto): converte CSV em linhas-objeto (com headers).
 *   2) sugerirMapeamento(headers, instrumento): heurística substring por
 *      pergunta (Q1..Q21) — usuário pode corrigir na UI.
 *   3) validarLinha(linha, mapeamento, instrumento): converte labels textuais
 *      (Sempre, Às vezes, ...) em valor_int conforme o tipo da pergunta. Faz
 *      crítica de range — escala fora do range vira erro de linha.
 *   4) importar(empresaId, csv, opts): registra cada linha como uma resposta
 *      DRPS via registrarResposta() (que já encapsula withEmpresa + RLS).
 *
 * Idempotência:
 *   - marcador_anonimo = sha256("import:" + instrumento_id + ":" + linha_normalizada).slice(0,32)
 *   - Como registrarResposta() faz UPSERT por (instrumento, marcador), re-rodar
 *     o mesmo CSV reescreve as MESMAS linhas (não duplica). Se o Forms preencheu
 *     "Carimbo de data/hora", entra na linha normalizada e o marcador fica
 *     único por submissão; caso contrário usa o hash do conteúdo de respostas.
 *
 * Sem PII — os campos de demografia (setor/função/tempo/forma de atuação) já
 * são informados pelo respondente (não identificam pessoa). Mesmo timestamp de
 * submissão é parte da linha normalizada (apenas pra produzir um marcador
 * único), nunca persistido em texto-claro além do que registrarResposta()
 * permite no schema atual.
 */

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                      */
/* -------------------------------------------------------------------------- */

export interface LinhaCSV {
  [coluna: string]: string;
}

/** Mapeamento de coluna do CSV → código da pergunta DRPS (ou null=ignorar). */
export type Mapeamento = Record<string, string | null>;

export interface InstrumentoCarregado {
  instrumento: { id: string; codigo: string; titulo: string };
  perguntas: Pergunta[];
}

export interface ItemValidado {
  pergunta_codigo: string;
  valor_int?: number | null;
  valor_texto?: string | null;
  opcoes_ids?: string[];
}

export interface LinhaValidada {
  ok: boolean;
  marcador: string;
  setor?: string | null;
  funcao?: string | null;
  tempo_empresa?: string | null;
  forma_atuacao?: string | null;
  itens: ItemValidado[];
  erros: string[];
}

export interface OpcoesImportar {
  mapeamento: Mapeamento;
  instrumento_id: string;
  campanha_id?: string | null;
  dryRun?: boolean;
}

export interface ResumoImport {
  total_lidas: number;
  sucesso: number;
  erros: Array<{ linha: number; motivos: string[] }>;
  dry_run: boolean;
}

/* -------------------------------------------------------------------------- */
/*  1) Parser CSV (sem dependência externa — Papa não está no projeto)         */
/* -------------------------------------------------------------------------- */

/**
 * Parser CSV simples, compatível com o output padrão do Google Forms:
 *   - Primeira linha = cabeçalho.
 *   - Valores entre aspas duplas (`"..."`) preservam vírgulas e quebras de
 *     linha internas. Aspas duplas escapam como `""`.
 *   - Separador: vírgula. EOL: \n ou \r\n.
 *
 * Retorna array de objetos `{ coluna: valor }`. Linhas vazias são puladas.
 * Não atira: chama com `texto = ""` retorna `[]`.
 */
export function parseCsv(texto: string): LinhaCSV[] {
  if (!texto) return [];
  // Normaliza BOM (Excel costuma adicionar UTF-8 BOM em CSVs exportados).
  const limpo = texto.replace(/^﻿/, "");

  const linhas: string[][] = [];
  let campo = "";
  let linhaAtual: string[] = [];
  let dentroAspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];

    if (dentroAspas) {
      if (c === '"') {
        // Aspas escapadas: ""
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroAspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    // Fora de aspas
    if (c === '"') {
      dentroAspas = true;
      continue;
    }
    if (c === ",") {
      linhaAtual.push(campo);
      campo = "";
      continue;
    }
    if (c === "\r") {
      // CRLF: consome o \n também
      if (limpo[i + 1] === "\n") i++;
      linhaAtual.push(campo);
      linhas.push(linhaAtual);
      campo = "";
      linhaAtual = [];
      continue;
    }
    if (c === "\n") {
      linhaAtual.push(campo);
      linhas.push(linhaAtual);
      campo = "";
      linhaAtual = [];
      continue;
    }
    campo += c;
  }

  // Campo / linha final
  if (campo.length > 0 || linhaAtual.length > 0) {
    linhaAtual.push(campo);
    linhas.push(linhaAtual);
  }

  if (linhas.length === 0) return [];
  const header = linhas[0].map((h) => h.trim());
  const rows: LinhaCSV[] = [];
  for (let r = 1; r < linhas.length; r++) {
    const cells = linhas[r];
    // Pula linhas totalmente vazias
    if (cells.every((c) => c.trim() === "")) continue;
    const obj: LinhaCSV = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = (cells[c] ?? "").trim();
    }
    rows.push(obj);
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/*  2) Sugestão de mapeamento por substring (heurística)                       */
/* -------------------------------------------------------------------------- */

/**
 * Regras de heurística para cabeçalhos típicos do Google Forms do
 * questionário Okêbambo (BACKLOG §2). Cada regra: substring case-insensitive
 * em uma coluna casa com o `codigo` da pergunta.
 *
 * Ordem importa — colocamos as substrings mais específicas primeiro para
 * evitar colisões (ex.: "estresse ou dificuldade" antes de regras genéricas).
 */
const REGRAS_HEURISTICA: Array<{ codigo: string; match: string[] }> = [
  // ── Carimbo de data/hora (ignorar como pergunta — vira marcador único)
  // não tem código; lookup de header é tratado fora de REGRAS.

  // ── Demografia
  { codigo: "Q1", match: ["em qual setor", "setor que voce atua", "setor"] },
  { codigo: "Q2", match: ["função", "funcao", "cargo"] },
  { codigo: "Q3", match: ["quanto tempo", "tempo de empresa", "tempo na empresa"] },
  { codigo: "Q4", match: ["forma de atuação", "forma de atuacao", "vínculo", "vinculo"] },

  // ── Likert 1-5 inversa (organização do trabalho)
  { codigo: "Q5", match: ["quantidade de atendimentos", "adequada para o seu tempo", "quantidade de tarefas"] },
  { codigo: "Q6", match: ["intervalos suficientes"] },
  { codigo: "Q7", match: ["registros", "relatórios", "relatorios", "planejamentos"] },

  // ── Likert 1-5 inversa (condições)
  { codigo: "Q8", match: ["condições do ambiente", "condicoes do ambiente", "ambiente da clínica oferece condições", "ambiente da clinica oferece condicoes"] },
  { codigo: "Q9", match: ["privacidade", "tranquilidade nos atendimentos"] },

  // ── Likert 1-5 inversa (relações)
  { codigo: "Q10", match: ["acolhedor", "respeitoso entre profissionais"] },
  { codigo: "Q13", match: ["suporte", "discutir casos", "casos difíceis", "casos dificeis"] },
  { codigo: "Q14", match: ["apoio da equipe"] },
  { codigo: "Q15", match: ["comunicação clara", "comunicacao clara", "comunicação entre profissionais", "comunicacao entre profissionais"] },
  { codigo: "Q16", match: ["confortável para falar", "confortavel para falar", "falar sobre dificuldades"] },

  // ── Likert 1-3 emocional
  { codigo: "Q11", match: ["situações emocionalmente", "situacoes emocionalmente", "emocionalmente difíceis", "emocionalmente dificeis"] },
  { codigo: "Q12", match: ["cansaço emocional", "cansaco emocional"] },

  // ── Impacto / esgotamento
  { codigo: "Q17", match: ["impactado sua saúde", "impactado sua saude", "impactou", "saúde emocional", "saude emocional", "saúde mental", "saude mental"] },
  { codigo: "Q18", match: ["esgotado", "esgotamento"] },

  // ── Multi-choice / texto
  { codigo: "Q19", match: ["estresse ou dificuldade", "maior gerador de estresse", "gerador de estresse"] },
  { codigo: "Q20", match: ["poderia melhorar", "sugestões de melhoria", "sugestoes de melhoria"] },
  { codigo: "Q21", match: ["gostaria de acrescentar", "comentários", "comentarios", "observações livres", "observacoes livres"] },
];

/**
 * Headers que NUNCA são respostas — sempre ignorados.
 * (Não viram pergunta; podem entrar no marcador de idempotência via `linha
 * normalizada`.)
 */
const HEADERS_IGNORADOS = [
  "carimbo de data/hora",
  "carimbo de data e hora",
  "timestamp",
  "pontuação",
  "pontuacao",
  "score",
  "endereço de e-mail",
  "endereco de e-mail",
  "endereço de email",
  "endereco de email",
  "email",
  "e-mail",
];

function normalizarTitulo(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (combining marks U+0300..U+036F)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sugere mapeamento coluna→pergunta via substring. Resultado:
 *   - chave: header exato do CSV
 *   - valor: codigo da pergunta (Q1..Q21) ou null (ignorar)
 *
 * Algoritmo:
 *   1) Se header bate em HEADERS_IGNORADOS → null.
 *   2) Para cada REGRA na ordem, se uma das substrings está no header normalizado → casa.
 *   3) Fallback: tenta achar substring do ENUNCIADO da pergunta no header.
 *   4) Sem match → null.
 *
 * Não atribui o mesmo codigo a duas colunas (primeira ganha).
 */
export function sugerirMapeamento(
  cabecalhos: string[],
  instrumento: InstrumentoCarregado,
): Mapeamento {
  const usados = new Set<string>();
  const out: Mapeamento = {};

  // Pre-normaliza enunciados pra fallback
  const enunciadoPorCodigo = new Map<string, string>();
  for (const p of instrumento.perguntas) {
    enunciadoPorCodigo.set(p.codigo, normalizarTitulo(p.enunciado));
  }

  for (const headerOriginal of cabecalhos) {
    const header = normalizarTitulo(headerOriginal);

    // 1) Ignorados explícitos
    if (HEADERS_IGNORADOS.some((h) => header.includes(normalizarTitulo(h)))) {
      out[headerOriginal] = null;
      continue;
    }

    // 2) Regras heurísticas (na ordem)
    let codigo: string | null = null;
    for (const regra of REGRAS_HEURISTICA) {
      if (usados.has(regra.codigo)) continue;
      const acertou = regra.match.some((sub) => header.includes(normalizarTitulo(sub)));
      if (acertou) {
        codigo = regra.codigo;
        break;
      }
    }

    // 3) Fallback: substring do enunciado (primeiros 40 chars)
    if (!codigo) {
      for (const [cod, enun] of enunciadoPorCodigo) {
        if (usados.has(cod)) continue;
        const trecho = enun.slice(0, 40);
        if (trecho.length > 10 && header.includes(trecho)) {
          codigo = cod;
          break;
        }
      }
    }

    if (codigo) {
      usados.add(codigo);
      out[headerOriginal] = codigo;
    } else {
      out[headerOriginal] = null;
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  3) Conversores de valores Likert (texto → int)                             */
/* -------------------------------------------------------------------------- */

/** Likert 1-5 inversa: Sempre=1 ... Nunca=5. */
const MAPA_LIKERT5: Record<string, number> = {
  "sempre": 1,
  "na maioria das vezes": 2,
  "as vezes": 3,
  "raramente": 4,
  "nunca": 5,
};

/** Likert 1-3 emocional (Q11/Q12). */
const MAPA_LIKERT3: Record<string, number> = {
  "raramente": 1,
  "as vezes": 2,
  "frequentemente": 3,
};

/** Impacto 1-4 (Q17). */
const MAPA_IMPACTO4: Record<string, number> = {
  "nao": 1,
  "levemente": 2,
  "moderadamente": 3,
  "significativamente": 4,
};

/** Esgotamento 1-5 (Q18). */
const MAPA_ESGOTAMENTO5: Record<string, number> = {
  "nunca": 1,
  "raramente": 2,
  "as vezes": 3,
  "frequentemente": 4,
  "sempre": 5,
};

function converterLabelLikert(
  tipo: Pergunta["tipo"],
  raw: string,
): number | null {
  const k = normalizarTitulo(raw);
  if (!k) return null;

  // Aceita também valor já numérico no CSV (ex: "3")
  const n = Number(raw.trim().replace(",", "."));
  if (Number.isFinite(n) && Number.isInteger(n)) {
    return validarRangeNumerico(tipo, n);
  }

  switch (tipo) {
    case "likert5_inverso":
      return MAPA_LIKERT5[k] ?? null;
    case "likert3_freq":
      return MAPA_LIKERT3[k] ?? null;
    case "impacto4":
      return MAPA_IMPACTO4[k] ?? null;
    case "esgotamento5":
      return MAPA_ESGOTAMENTO5[k] ?? null;
    default:
      return null;
  }
}

function validarRangeNumerico(tipo: Pergunta["tipo"], v: number): number | null {
  switch (tipo) {
    case "likert5_inverso":
    case "esgotamento5":
      return v >= 1 && v <= 5 ? v : null;
    case "likert3_freq":
      return v >= 1 && v <= 3 ? v : null;
    case "impacto4":
      return v >= 1 && v <= 4 ? v : null;
    default:
      return null;
  }
}

/**
 * Para perguntas multi_choice: divide a string CSV por vírgula/ponto-e-vírgula
 * e tenta casar cada token (case-insensitive) com `opcao.label`. Tokens sem
 * match viram comentário no valor_texto (em "Outro").
 */
function converterMultiChoice(opcoes: Opcao[], raw: string): { ids: string[]; texto: string | null } {
  if (!raw) return { ids: [], texto: null };
  const tokens = raw
    .split(/[;,]/g)
    .map((t) => t.trim())
    .filter(Boolean);
  const ids: string[] = [];
  const sobrou: string[] = [];
  for (const tok of tokens) {
    const norm = normalizarTitulo(tok);
    const found = opcoes.find((o) => normalizarTitulo(o.label) === norm);
    if (found) ids.push(found.id);
    else sobrou.push(tok);
  }
  return { ids, texto: sobrou.length ? sobrou.join("; ") : null };
}

/* -------------------------------------------------------------------------- */
/*  4) Validação de linha individual                                           */
/* -------------------------------------------------------------------------- */

/**
 * Valida e converte uma linha do CSV em items DRPS. Não grava.
 *
 * Erros viram entradas em `erros[]`. A linha continua passando os items que
 * puderam ser convertidos. Só marca `ok=false` se nenhum item válido sair OU
 * se algum erro de range fatal aparecer (escala fora do range esperado).
 */
export function validarLinha(
  linha: LinhaCSV,
  mapeamento: Mapeamento,
  instrumento: InstrumentoCarregado,
): LinhaValidada {
  const erros: string[] = [];
  const itens: ItemValidado[] = [];
  const byCodigo = new Map(instrumento.perguntas.map((p) => [p.codigo, p]));

  // Campos demográficos auto-detectados pelos codigos Q1..Q4 mapeados
  let setor: string | null = null;
  let funcao: string | null = null;
  let tempo_empresa: string | null = null;
  let forma_atuacao: string | null = null;

  for (const [coluna, codigo] of Object.entries(mapeamento)) {
    if (!codigo) continue;
    const p = byCodigo.get(codigo);
    if (!p) {
      erros.push(`Mapeamento aponta pra pergunta inexistente: ${codigo}`);
      continue;
    }
    const raw = (linha[coluna] ?? "").trim();
    if (!raw) continue; // vazio = não respondeu (ok, demais perguntas seguem)

    switch (p.tipo) {
      case "demografia": {
        // Q1..Q4 são demografia
        if (codigo === "Q1") setor = raw.slice(0, 80);
        else if (codigo === "Q2") funcao = raw.slice(0, 80);
        else if (codigo === "Q3") tempo_empresa = raw.slice(0, 40);
        else if (codigo === "Q4") forma_atuacao = raw.slice(0, 40);
        else itens.push({ pergunta_codigo: codigo, valor_texto: raw.slice(0, 2000) });
        break;
      }
      case "likert5_inverso":
      case "likert3_freq":
      case "impacto4":
      case "esgotamento5": {
        const v = converterLabelLikert(p.tipo, raw);
        if (v == null) {
          erros.push(`${codigo}: valor fora da escala (${raw.slice(0, 40)})`);
        } else {
          itens.push({ pergunta_codigo: codigo, valor_int: v });
        }
        break;
      }
      case "multi_choice": {
        const { ids, texto } = converterMultiChoice(p.opcoes, raw);
        if (ids.length === 0 && !texto) {
          // ignora silenciosamente — não é erro
        } else {
          itens.push({
            pergunta_codigo: codigo,
            opcoes_ids: ids.length ? ids : undefined,
            valor_texto: texto ?? undefined,
          });
        }
        break;
      }
      case "texto": {
        itens.push({ pergunta_codigo: codigo, valor_texto: raw.slice(0, 2000) });
        break;
      }
    }
  }

  // Marcador anônimo: hash determinístico da linha normalizada
  const marcador = marcadorDeLinha(instrumento.instrumento.id, linha);

  const ok = erros.length === 0 && itens.length > 0;
  return {
    ok,
    marcador,
    setor,
    funcao,
    tempo_empresa,
    forma_atuacao,
    itens,
    erros,
  };
}

/**
 * Marcador anônimo derivado de:
 *   sha256("import:" + instrumento_id + ":" + JSON(linha ordenada por chave))
 *
 * Por que assim: o Google Forms emite "Carimbo de data/hora" único por
 * submissão — quando presente, basta entrar na linha normalizada pra produzir
 * marcadores únicos. Se o Carimbo NÃO estiver no CSV, o hash continua único
 * por combinação de respostas (idempotência: re-import do MESMO CSV não
 * duplica, mas duas submissões idênticas — improvável — colidiriam, que é o
 * comportamento esperado para idempotência).
 */
function marcadorDeLinha(instrumentoId: string, linha: LinhaCSV): string {
  const chaves = Object.keys(linha).sort();
  const canonico = chaves.map((k) => `${k}=${linha[k] ?? ""}`).join("|");
  return createHash("sha256")
    .update(`import:${instrumentoId}:${canonico}`)
    .digest("hex")
    .slice(0, 32);
}

/* -------------------------------------------------------------------------- */
/*  5) Importar (orquestrador)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Importa um CSV inteiro:
 *   - parseCsv
 *   - para cada linha: validarLinha
 *   - se válido E !dryRun: registrarResposta(empresaId, ...) (que usa
 *     withEmpresa internamente, respeitando RLS)
 *
 * Retorna `{ total_lidas, sucesso, erros[], dry_run }`. Em dryRun NADA é
 * gravado — útil pra preview na UI antes do commit.
 *
 * Idempotência: `marcador_anonimo` deterministico (vide marcadorDeLinha).
 * registrarResposta() faz UPSERT por (instrumento, marcador), então re-rodar
 * o mesmo CSV reescreve as MESMAS linhas (não duplica).
 */
export async function importar(
  empresaId: string,
  csv: string,
  opts: OpcoesImportar,
): Promise<ResumoImport> {
  const dryRun = Boolean(opts.dryRun);
  const linhas = parseCsv(csv);

  // Carrega instrumento (perguntas + opcoes) — usa sqlAdmin (cross-tenant
  // ok pra LER template global; registrarResposta abaixo escopa por empresa).
  const carregado = await carregarInstrumentoComPerguntas(opts.instrumento_id);
  if (!carregado) {
    return {
      total_lidas: linhas.length,
      sucesso: 0,
      erros: [{ linha: 0, motivos: ["Instrumento não encontrado."] }],
      dry_run: dryRun,
    };
  }
  const inst: InstrumentoCarregado = {
    instrumento: carregado.instrumento,
    perguntas: carregado.perguntas,
  };

  let sucesso = 0;
  const erros: Array<{ linha: number; motivos: string[] }> = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const validada = validarLinha(linha, opts.mapeamento, inst);

    if (!validada.ok) {
      erros.push({
        linha: i + 2, // +1 pra header, +1 pra 1-index humano
        motivos: validada.erros.length
          ? validada.erros
          : ["Sem itens válidos pra registrar."],
      });
      continue;
    }

    if (dryRun) {
      sucesso++;
      continue;
    }

    try {
      await registrarResposta(empresaId, inst.instrumento.id, {
        marcador_anonimo: validada.marcador,
        setor: validada.setor,
        funcao: validada.funcao,
        tempo_empresa: validada.tempo_empresa,
        forma_atuacao: validada.forma_atuacao,
        canal: "web",
        respostas: validada.itens.map((it) => ({
          pergunta_codigo: it.pergunta_codigo,
          valor_int: it.valor_int ?? null,
          valor_texto: it.valor_texto ?? null,
          opcoes_ids: it.opcoes_ids,
        })),
      });
      sucesso++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      erros.push({ linha: i + 2, motivos: [`Falha ao registrar: ${msg}`] });
    }
  }

  return {
    total_lidas: linhas.length,
    sucesso,
    erros,
    dry_run: dryRun,
  };
}

/* -------------------------------------------------------------------------- */
/*  Util: lista de perguntas pra UI de mapeamento (dropdown)                   */
/* -------------------------------------------------------------------------- */

export interface PerguntaParaUI {
  codigo: string;
  ordem: number;
  enunciado: string;
  tipo: string;
}

export function perguntasParaUI(inst: InstrumentoCarregado): PerguntaParaUI[] {
  return inst.perguntas
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => ({
      codigo: p.codigo,
      ordem: p.ordem,
      enunciado: p.enunciado,
      tipo: p.tipo,
    }));
}
