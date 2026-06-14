import "server-only";
import { sql } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";
import {
  classificarRisco,
  type Probabilidade,
  type Impacto,
} from "@/lib/matriz-risco";
import { sugerirProbabilidade } from "@/lib/matriz-risco-server";
import {
  type Classificacao,
  validarAmostra,
} from "@/lib/drps-escoragem";

/**
 * Camada de leitura cruzando o catálogo NR-1 (Dev A) com a probabilidade
 * derivada do DRPS (lib/matriz-risco) e o impacto manual (default 'medio').
 *
 * Defensiva: se o catálogo do Dev A ainda não foi aplicado, retorna lista
 * vazia em vez de quebrar a página. A UI mostra um aviso "catálogo ainda
 * não disponível" no skeleton.
 */

export interface DimensaoNR1 {
  id: string;
  nome: string;
}

export interface FatorNR1 {
  id: string;
  dim_id: string;
  nome: string;
  /** ID da dimensão, denormalizado para facilitar agregação na UI. */
  dim_nome?: string | null;
}

export interface FatorComRisco extends FatorNR1 {
  probabilidade: Probabilidade;
  impacto: Impacto;
  classificacao: Classificacao;
  frequencia: number; // 0..1 (% de respostas que citaram)
  n_citacoes: number;
  n_respostas: number;
  /** True quando a amostra atinge o mínimo k=7 (LGPD). False = ocultar dados sensíveis. */
  kAnonimato: boolean;
  /** Motivo da invalidação da amostra (quando kAnonimato=false). */
  motivoAmostra?: "amostra_insuficiente";
}

/** Lista as 5 dimensões. Vazio se o catálogo não está disponível. */
export async function listarDimensoes(): Promise<DimensaoNR1[]> {
  const ok = await catalogoDisponivel();
  if (!ok) return [];
  const rows = await sql<DimensaoNR1[]>`
    select id, nome from public.dim_nr1 order by nome
  `;
  return rows;
}

/** Lista os 35 fatores (catálogo global). */
export async function listarFatores(): Promise<FatorNR1[]> {
  const ok = await catalogoDisponivel();
  if (!ok) return [];
  const rows = await sql<FatorNR1[]>`
    select f.id, f.dim_id, f.nome, d.nome as dim_nome
      from public.fator_nr1 f
      left join public.dim_nr1 d on d.id = f.dim_id
     order by d.nome, f.nome
  `;
  return rows;
}

/**
 * Para cada fator, calcula probabilidade sugerida (DRPS) e impacto default
 * ('medio'). UI permite o SST ajustar o impacto manualmente — por enquanto
 * trabalhamos com o default; persistência fica para uma próxima migration.
 */
export async function listarFatoresComRisco(
  empresaId: string,
): Promise<FatorComRisco[]> {
  const fatores = await listarFatores();
  if (fatores.length === 0) return [];

  // Roda sugestão dentro de UM escopo (otimização — evita N transações).
  return withEmpresa(empresaId, async () => {
    const out: FatorComRisco[] = [];
    for (const f of fatores) {
      // sugerirProbabilidade abre seu próprio withEmpresa, mas a função é
      // re-entrante (a transação interna é reusada via ALS). Ok.
      const sug = await sugerirProbabilidade(empresaId, f.id);
      const impacto: Impacto = "medio";

      // K-anonimato (LGPD): se a amostra é menor que 7, NÃO expomos
      // frequência/citações (risco de re-identificação). Mantemos a
      // probabilidade default ("baixa") só pra a matriz não quebrar, mas o
      // fator carrega `kAnonimato=false` pra UI omitir os dados sensíveis.
      const amostra = validarAmostra(sug.n_respostas);
      const kAnonimato = amostra.ok;

      out.push({
        ...f,
        probabilidade: sug.probabilidade,
        impacto,
        classificacao: classificarRisco(sug.probabilidade, impacto),
        frequencia: kAnonimato ? sug.frequencia : 0,
        n_citacoes: kAnonimato ? sug.n_citacoes : 0,
        n_respostas: sug.n_respostas, // n total continua útil pra UI saber por quê
        kAnonimato,
        ...(kAnonimato ? {} : { motivoAmostra: "amostra_insuficiente" as const }),
      });
    }
    return out;
  });
}

/** True se as tabelas dim_nr1 / fator_nr1 existem. */
export async function catalogoDisponivel(): Promise<boolean> {
  try {
    const rows = await sql<{ tabela: string }[]>`
      select table_name as tabela
        from information_schema.tables
       where table_schema = 'public'
         and table_name in ('dim_nr1','fator_nr1')
    `;
    const nomes = new Set(rows.map((r) => r.tabela));
    return nomes.has("dim_nr1") && nomes.has("fator_nr1");
  } catch {
    return false;
  }
}
