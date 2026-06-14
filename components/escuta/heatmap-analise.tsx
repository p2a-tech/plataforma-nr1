import { rotuloClassificacao, type Classificacao } from "@/lib/drps-escoragem";
import type { AnalisePorSetor } from "@/lib/drps-analise";

/**
 * Heatmap setor × dimensão (5 dimensões NR-1).
 *
 * Cada célula mostra a média DRPS do setor naquela dimensão, com cor:
 *   - baixo  → verde  (ok)
 *   - moderado → âmbar  (humano-soft)
 *   - alto   → vermelho (alerta)
 *
 * Setor com amostra insuficiente (n<7) renderiza linha esmaecida com um
 * indicador de "n<7" no lugar da média (LGPD §3 escoragem).
 *
 * Server component — recebe a análise pronta e só formata.
 */

function corDeClassificacao(c: Classificacao | null): string {
  switch (c) {
    case "baixo":
      return "bg-ok/15 text-ok ring-1 ring-inset ring-ok/25";
    case "moderado":
      return "bg-humano-soft/15 text-humano-soft ring-1 ring-inset ring-humano-soft/25";
    case "alto":
      return "bg-alerta/15 text-alerta ring-1 ring-inset ring-alerta/25";
    default:
      return "bg-fill/5 text-ink-muted ring-1 ring-inset ring-line/10";
  }
}

export function HeatmapAnalise({
  setores,
}: {
  setores: AnalisePorSetor[];
}) {
  if (setores.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        Sem respostas DRPS para gerar o heatmap.
      </p>
    );
  }

  // Coleta as dimensões a partir do primeiro setor (todas têm a mesma ordem
  // de dimensões — vide analisePorSetor).
  const dims = setores[0].por_dimensao.map((d) => ({
    dim_id: d.dim_id,
    dim_nome: d.dim_nome,
  }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
          <tr>
            <th className="py-2 pr-3">Setor</th>
            <th className="py-2 pr-3 text-center">n</th>
            <th className="py-2 pr-3 text-center">Média</th>
            {dims.map((d) => (
              <th
                key={d.dim_id}
                className="py-2 pr-3 text-center"
                title={d.dim_nome}
              >
                {d.dim_nome.split(" ")[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {setores.map((s) => (
            <tr
              key={s.setor}
              className={
                "border-t border-line/5 " +
                (s.amostra_insuficiente ? "opacity-60" : "")
              }
            >
              <td className="py-2 pr-3 text-ink/85">{s.setor}</td>
              <td className="py-2 pr-3 text-center text-ink-muted">
                {s.n_respostas}
              </td>
              <td className="py-2 pr-3 text-center">
                {s.amostra_insuficiente ? (
                  <span className="text-[11px] text-ink-muted">n&lt;7</span>
                ) : (
                  <span
                    className={
                      "inline-flex min-w-[3.5rem] items-center justify-center rounded-md px-2 py-1 text-xs font-semibold " +
                      corDeClassificacao(s.classificacao)
                    }
                    title={
                      s.classificacao
                        ? rotuloClassificacao(s.classificacao)
                        : undefined
                    }
                  >
                    {s.media?.toFixed(2)}
                  </span>
                )}
              </td>
              {s.por_dimensao.map((d) => (
                <td key={d.dim_id} className="py-2 pr-3 text-center">
                  {s.amostra_insuficiente || d.media == null ? (
                    <span className="text-[11px] text-ink-muted">—</span>
                  ) : (
                    <span
                      className={
                        "inline-flex min-w-[3.5rem] items-center justify-center rounded-md px-2 py-1 text-xs font-semibold " +
                        corDeClassificacao(d.classificacao)
                      }
                      title={
                        d.classificacao
                          ? `${d.dim_nome} · ${rotuloClassificacao(d.classificacao)}`
                          : d.dim_nome
                      }
                    >
                      {d.media.toFixed(2)}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        Escala 1-5 (convenção PrevIA): maior = mais risco. Faixas: ≤2.0 baixo · 2.1-3.5 moderado · &gt;3.5 alto. Setores com menos de 7 respostas têm a média ocultada (LGPD · k-anonimato).
      </p>
    </div>
  );
}
