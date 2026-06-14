import "server-only";
import { sql } from "@/lib/db";
import { withEmpresa } from "@/lib/tenant";
import type { Probabilidade, SugestaoProbabilidade } from "@/lib/matriz-risco";

/**
 * Lado server da matriz de risco. Vive separado de `lib/matriz-risco.ts`
 * (puro) para que componentes client possam usar a tabela / rótulos sem
 * puxar `server-only` na bundle.
 *
 * Sugere a probabilidade de um fator a partir da frequência com que o
 * ofensor é citado nas respostas DRPS (Q19 multi-choice). Regra do
 * BACKLOG §4: ≥ 40% → Alta · 15-40% → Média · < 15% → Baixa.
 *
 * Resiliente: se as tabelas DRPS do Dev A ainda não existirem ou estiverem
 * vazias, devolve frequência 0 / probabilidade "baixa" (fail-safe).
 */
export async function sugerirProbabilidade(
  empresaId: string,
  fatorId: string,
): Promise<SugestaoProbabilidade> {
  return withEmpresa(empresaId, async () => {
    const tabelas = await sql<{ tabela: string }[]>`
      select table_name as tabela
        from information_schema.tables
       where table_schema = 'public'
         and table_name in ('drps_resposta','drps_resposta_opcao','drps_opcao')
    `;
    const nomes = new Set(tabelas.map((t) => t.tabela));
    if (!nomes.has("drps_resposta") || !nomes.has("drps_resposta_opcao") || !nomes.has("drps_opcao")) {
      return {
        probabilidade: "baixa",
        frequencia: 0,
        n_respostas: 0,
        n_citacoes: 0,
      } as SugestaoProbabilidade;
    }

    const [tot] = await sql<{ n: number }[]>`
      select count(*)::int as n
        from public.drps_resposta
       where empresa_id = ${empresaId}
    `;
    const n_respostas = tot?.n ?? 0;
    if (n_respostas === 0) {
      return { probabilidade: "baixa", frequencia: 0, n_respostas: 0, n_citacoes: 0 };
    }

    const [cit] = await sql<{ n: number }[]>`
      select count(distinct ro.resposta_id)::int as n
        from public.drps_resposta_opcao ro
        join public.drps_opcao o on o.id = ro.opcao_id
        join public.drps_resposta r on r.id = ro.resposta_id
       where r.empresa_id = ${empresaId}
         and o.fator_id = ${fatorId}
    `;
    const n_citacoes = cit?.n ?? 0;
    const frequencia = n_respostas > 0 ? n_citacoes / n_respostas : 0;
    const probabilidade: Probabilidade =
      frequencia >= 0.4 ? "alta" : frequencia >= 0.15 ? "media" : "baixa";
    return {
      probabilidade,
      frequencia: Number(frequencia.toFixed(3)),
      n_respostas,
      n_citacoes,
    };
  });
}
