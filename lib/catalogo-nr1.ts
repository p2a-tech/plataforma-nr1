import "server-only";
import { sqlAdmin } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";

/**
 * Catálogo NR-1 oficial (5 dimensões + fatores psicossociais).
 *
 * O catálogo é GLOBAL (sem tenant) — todas as empresas referenciam os mesmos
 * IDs (`org_trabalho`, `sobrecarga`, etc.). Usamos `sqlAdmin` direto para ler
 * porque as tabelas não têm RLS (ver migration 0011).
 *
 * Só a função `contagemPorDimensao` é tenant-scoped: ela agrega o uso do
 * catálogo dentro de uma empresa (joins com `drps_resposta_item` para
 * descobrir quantas respostas mencionaram cada dimensão).
 */

export interface Dimensao {
  id: string;
  ordem: number;
  nome: string;
  descricao: string;
}

export interface Fator {
  id: string;
  dim_id: string;
  dim_nome: string;
  nome: string;
  descricao: string;
  codigo_esocial: string | null;
  ordem: number;
}

/** Lista as 5 dimensões oficiais NR-1 ordenadas. */
export async function listarDimensoes(): Promise<Dimensao[]> {
  return sqlAdmin<Dimensao[]>`
    select id, ordem, nome, descricao
      from public.dim_nr1
     order by ordem
  `;
}

/** Lista os fatores com o nome da dimensão (join). */
export async function listarFatores(): Promise<Fator[]> {
  return sqlAdmin<Fator[]>`
    select f.id, f.dim_id, d.nome as dim_nome, f.nome, f.descricao,
           f.codigo_esocial, f.ordem
      from public.fator_nr1 f
      join public.dim_nr1 d on d.id = f.dim_id
     order by d.ordem, f.ordem
  `;
}

/** Fatores de uma dimensão específica. */
export async function porDimensao(dimId: string): Promise<Fator[]> {
  return sqlAdmin<Fator[]>`
    select f.id, f.dim_id, d.nome as dim_nome, f.nome, f.descricao,
           f.codigo_esocial, f.ordem
      from public.fator_nr1 f
      join public.dim_nr1 d on d.id = f.dim_id
     where f.dim_id = ${dimId}
     order by f.ordem
  `;
}

export interface ContagemDimensao {
  dim_id: string;
  dim_nome: string;
  ordem: number;
  perguntas: number;     // perguntas mapeadas para a dimensão
  respostas: number;     // itens de resposta efetivamente registrados
}

/**
 * Quantas respostas DRPS da empresa caem em cada dimensão NR-1.
 * Usa join com `drps_pergunta.dim_id` — a tenant-aware via withEmpresa para
 * aplicar RLS na agregação de respostas.
 */
export async function contagemPorDimensao(
  empresaId: string,
): Promise<ContagemDimensao[]> {
  return withEmpresa(empresaId, async () => {
    // Importação tardia pra evitar ciclo (drps.ts não precisa, mas mantemos
    // o padrão de usar `sql` proxy via tenant).
    const { sql } = await import("@/lib/db");
    return sql<ContagemDimensao[]>`
      select d.id   as dim_id,
             d.nome as dim_nome,
             d.ordem,
             count(distinct p.id)::int  as perguntas,
             count(ri.id)::int          as respostas
        from public.dim_nr1 d
        left join public.drps_pergunta p on p.dim_id = d.id
        left join public.drps_resposta_item ri on ri.pergunta_id = p.id
        left join public.drps_resposta r on r.id = ri.resposta_id
       where r.empresa_id is null or r.empresa_id = ${empresaId}
       group by d.id, d.nome, d.ordem
       order by d.ordem
    `;
  });
}
