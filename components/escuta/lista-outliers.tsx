import {
  rotuloClassificacao,
  toneClassificacao,
} from "@/lib/drps-escoragem";
import type { Outlier } from "@/lib/drps-analise";
import { Badge } from "@/components/ui/primitives";

/**
 * Lista de setores outliers — setores cuja média DRPS está acima da média
 * geral por uma margem significativa (vide `outliersSetoriais`). Lista
 * descendente por desvio, com link futuro pra filtrar a análise.
 *
 * Server component — só formata.
 */

export function ListaOutliers({ outliers }: { outliers: Outlier[] }) {
  if (outliers.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        Nenhum setor com risco acima do esperado nesta amostra. 🎯
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
          <tr>
            <th className="py-2 pr-3">Setor</th>
            <th className="py-2 pr-3 text-center">n</th>
            <th className="py-2 pr-3 text-center">Média</th>
            <th className="py-2 pr-3 text-center">Desvio</th>
            <th className="py-2 pr-3 text-center">Classificação</th>
          </tr>
        </thead>
        <tbody>
          {outliers.map((o) => (
            <tr key={o.setor} className="border-t border-line/5 text-ink/85">
              <td className="py-2 pr-3 font-medium text-ink">{o.setor}</td>
              <td className="py-2 pr-3 text-center text-ink-muted">
                {o.n_respostas}
              </td>
              <td className="py-2 pr-3 text-center font-semibold">
                {o.media.toFixed(2)}
              </td>
              <td className="py-2 pr-3 text-center text-alerta">
                +{o.desvio.toFixed(2)}
              </td>
              <td className="py-2 pr-3 text-center">
                <Badge tone={toneClassificacao(o.classificacao)}>
                  {rotuloClassificacao(o.classificacao)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        Desvio = média do setor menos média geral. Threshold: max(1.0, 0.5·DP).
      </p>
    </div>
  );
}
