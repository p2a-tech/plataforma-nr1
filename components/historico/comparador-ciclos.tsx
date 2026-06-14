"use client";

import { useMemo, useState } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import {
  classificar,
  toneClassificacao,
  rotuloClassificacao,
} from "@/lib/drps-escoragem";

/**
 * ComparadorCiclos — seletores A vs B + tabela de deltas por dimensão.
 *
 * Client component (recebe a série completa pré-calculada pelo server). Para
 * ficar reativo sem fetcher, deriva a comparação no cliente a partir da mesma
 * `serie` que alimenta o gráfico de evolução.
 *
 * Regressão: delta = mediaB - mediaA > 0.5 (BACKLOG §8, mantido em LIMITE_REGRESSAO).
 * Sinal POSITIVO porque score maior = mais risco (convenção PrevIA).
 */

export interface SerieParaComparar {
  ciclo: string;
  ordem: number;
  media_geral: number;
  n_respostas: number;
  mediaPorDim: { dim_id: string; dim_nome: string; media: number; n_respostas: number }[];
}

const LIMITE = 0.5;

export function ComparadorCiclos({ serie }: { serie: SerieParaComparar[] }) {
  const inicial = useMemo(() => {
    if (serie.length < 2) {
      return { a: serie[0]?.ciclo ?? null, b: serie[0]?.ciclo ?? null };
    }
    return {
      a: serie[serie.length - 2].ciclo,
      b: serie[serie.length - 1].ciclo,
    };
  }, [serie]);

  const [cicloA, setCicloA] = useState<string | null>(inicial.a);
  const [cicloB, setCicloB] = useState<string | null>(inicial.b);

  const comparacao = useMemo(() => {
    const ptA = serie.find((p) => p.ciclo === cicloA);
    const ptB = serie.find((p) => p.ciclo === cicloB);
    const dims = new Map<string, string>();
    for (const d of ptA?.mediaPorDim ?? []) dims.set(d.dim_id, d.dim_nome);
    for (const d of ptB?.mediaPorDim ?? []) dims.set(d.dim_id, d.dim_nome);
    return [...dims.entries()]
      .map(([dim_id, dim_nome]) => {
        const a = ptA?.mediaPorDim.find((x) => x.dim_id === dim_id);
        const b = ptB?.mediaPorDim.find((x) => x.dim_id === dim_id);
        const mediaA = a?.media ?? 0;
        const mediaB = b?.media ?? 0;
        const delta = Number((mediaB - mediaA).toFixed(3));
        return {
          dim_id,
          dim_nome,
          mediaA,
          mediaB,
          nA: a?.n_respostas ?? 0,
          nB: b?.n_respostas ?? 0,
          delta,
          regressao: delta > LIMITE,
        };
      })
      .sort((x, y) => y.delta - x.delta);
  }, [serie, cicloA, cicloB]);

  if (serie.length < 2) {
    return (
      <div className="py-8 text-center text-sm text-ink-muted">
        Pelo menos 2 ciclos são necessários para comparar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-ink-muted">Ciclo A</span>
          <select
            value={cicloA ?? ""}
            onChange={(e) => setCicloA(e.target.value)}
            className="rounded-md border border-line/15 bg-navy-deep px-2 py-1 text-xs text-ink"
          >
            {serie.map((p) => (
              <option key={p.ciclo} value={p.ciclo}>
                {p.ciclo}
              </option>
            ))}
          </select>
        </label>
        <ArrowRight className="h-4 w-4 text-ink-muted" />
        <label className="flex items-center gap-2">
          <span className="text-ink-muted">Ciclo B</span>
          <select
            value={cicloB ?? ""}
            onChange={(e) => setCicloB(e.target.value)}
            className="rounded-md border border-line/15 bg-navy-deep px-2 py-1 text-xs text-ink"
          >
            {serie.map((p) => (
              <option key={p.ciclo} value={p.ciclo}>
                {p.ciclo}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[11px] text-ink-muted">
          delta &gt; {LIMITE} = regressão
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="py-2 pr-3">Dimensão</th>
              <th className="py-2 pr-3">Média A</th>
              <th className="py-2 pr-3">Média B</th>
              <th className="py-2 pr-3">Δ</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {comparacao.map((c) => {
              const classB = classificar(c.mediaB);
              return (
                <tr
                  key={c.dim_id}
                  className={`border-t border-line/5 text-ink/85 ${
                    c.regressao ? "bg-alerta/5" : ""
                  }`}
                >
                  <td className="py-2 pr-3 font-medium text-ink">{c.dim_nome}</td>
                  <td className="py-2 pr-3 tabular-nums">{c.mediaA.toFixed(2)}</td>
                  <td className="py-2 pr-3 tabular-nums">{c.mediaB.toFixed(2)}</td>
                  <td
                    className={`py-2 pr-3 tabular-nums ${
                      c.delta > 0 ? "text-alerta" : c.delta < 0 ? "text-ok" : ""
                    }`}
                  >
                    {c.delta > 0 ? "+" : ""}
                    {c.delta.toFixed(2)}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={toneClassificacao(classB)}>
                        {rotuloClassificacao(classB)}
                      </Badge>
                      {c.regressao && (
                        <Badge tone="alerta">
                          <AlertTriangle className="h-3 w-3" />
                          regressão
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
