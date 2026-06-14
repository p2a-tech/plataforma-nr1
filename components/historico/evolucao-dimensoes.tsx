"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/primitives";

/**
 * EvolucaoDimensoes — chart SVG inline das 5 dimensões NR-1 ao longo dos ciclos.
 *
 * Esboço visual (modo claro/escuro herdado pela paleta):
 *
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ Evolução das dimensões                          [escala risco 1-5]   │
 *   │                                                                      │
 *   │  5 ┤                                            ─── Carga emocional  │
 *   │  4 ┤                       ●                                         │
 *   │  3 ┤                   ●        ●                                    │
 *   │  2 ┤      ●     ●                                                    │
 *   │  1 ┤                                                                 │
 *   │     ─────────────────────────────────────────────                    │
 *   │     q3-2025  q4-2025  q1-2026  q2-2026                               │
 *   │                                                                      │
 *   │  [ ✓ Org · ✓ Carga · ✓ Relações · ✓ Condições · ✓ Segurança ]        │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * Sem dependência de recharts pra simplificar SSR/CSR — SVG puro.
 * Cores fixas (paleta consistente: ia/ok/humano/ambar/alerta).
 */

export interface SerieItem {
  ciclo: string;
  ordem: number;
  media_geral: number;
  n_respostas: number;
  mediaPorDim: { dim_id: string; dim_nome: string; media: number }[];
}

const CORES: Record<string, string> = {
  org_trabalho: "#00C2D1", // ia
  carga_emocional: "#E5484D", // alerta
  relacoes: "#FF6B35", // humano
  condicoes: "#27AE60", // ok
  seguranca_emoc: "#A78BFA", // violet (acento)
};

const NOMES_CURTOS: Record<string, string> = {
  org_trabalho: "Org. trabalho",
  carga_emocional: "Carga emocional",
  relacoes: "Relações",
  condicoes: "Condições",
  seguranca_emoc: "Segurança emoc.",
};

export function EvolucaoDimensoes({ serie }: { serie: SerieItem[] }) {
  const [visiveis, setVisiveis] = useState<Set<string>>(() => {
    // Por padrão, todas as dimensões visíveis.
    const ids = new Set<string>();
    for (const p of serie)
      for (const d of p.mediaPorDim) ids.add(d.dim_id);
    return ids;
  });

  const dims = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of serie) for (const d of p.mediaPorDim) m.set(d.dim_id, d.dim_nome);
    return [...m.entries()].map(([id, nome]) => ({ id, nome }));
  }, [serie]);

  if (serie.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-ink-muted">
        Sem ciclos para comparar ainda. Crie campanhas com ciclos distintos
        (ex.: q1-2026, q2-2026) para começar a ver evolução.
      </div>
    );
  }

  // Dimensões do SVG
  const W = 640;
  const H = 260;
  const padL = 36;
  const padR = 16;
  const padT = 20;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xStep = serie.length > 1 ? innerW / (serie.length - 1) : 0;
  const yMin = 1;
  const yMax = 5;
  const yScale = (v: number) =>
    padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const xScale = (i: number) =>
    serie.length === 1 ? padL + innerW / 2 : padL + i * xStep;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <TrendingUp className="h-3.5 w-3.5" />
          escala 1 (baixo risco) ↔ 5 (alto risco)
        </div>
        <Badge tone="neutro">
          {serie.length} ciclo{serie.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block min-w-[480px] text-ink-muted"
          role="img"
          aria-label="Gráfico de evolução das 5 dimensões NR-1"
        >
          {/* Grid horizontal */}
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line
                x1={padL}
                x2={W - padR}
                y1={yScale(v)}
                y2={yScale(v)}
                stroke="currentColor"
                strokeOpacity={v === 1 || v === 5 ? 0.25 : 0.1}
                strokeDasharray={v === 1 || v === 5 ? undefined : "3 3"}
              />
              <text
                x={padL - 6}
                y={yScale(v) + 3}
                textAnchor="end"
                fontSize={10}
                fill="currentColor"
                opacity={0.7}
              >
                {v}
              </text>
            </g>
          ))}

          {/* Faixas de classificação (cor de fundo sutil) */}
          <rect
            x={padL}
            y={yScale(2.0)}
            width={innerW}
            height={yScale(1) - yScale(2.0)}
            fill="#27AE60"
            fillOpacity={0.05}
          />
          <rect
            x={padL}
            y={yScale(3.5)}
            width={innerW}
            height={yScale(2.0) - yScale(3.5)}
            fill="#E5A23B"
            fillOpacity={0.05}
          />
          <rect
            x={padL}
            y={yScale(5)}
            width={innerW}
            height={yScale(3.5) - yScale(5)}
            fill="#E5484D"
            fillOpacity={0.05}
          />

          {/* Linhas por dimensão */}
          {dims.map(({ id, nome }) => {
            if (!visiveis.has(id)) return null;
            const pts: { x: number; y: number; v: number }[] = [];
            serie.forEach((p, i) => {
              const d = p.mediaPorDim.find((x) => x.dim_id === id);
              if (d) pts.push({ x: xScale(i), y: yScale(d.media), v: d.media });
            });
            if (pts.length === 0) return null;
            const path = pts
              .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
              .join(" ");
            const cor = CORES[id] ?? "#9BA3AF";
            return (
              <g key={id}>
                <path d={path} stroke={cor} strokeWidth={2} fill="none" />
                {pts.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={3}
                    fill={cor}
                    stroke="#0B1220"
                    strokeWidth={1}
                  >
                    <title>{`${nome}: ${pt.v.toFixed(2)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {/* Eixo X (ciclos) */}
          {serie.map((p, i) => (
            <text
              key={p.ciclo}
              x={xScale(i)}
              y={H - padB + 16}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              opacity={0.75}
            >
              {p.ciclo}
            </text>
          ))}
        </svg>
      </div>

      {/* Legenda toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {dims.map(({ id, nome }) => {
          const ativo = visiveis.has(id);
          const cor = CORES[id] ?? "#9BA3AF";
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                const next = new Set(visiveis);
                if (ativo) next.delete(id);
                else next.add(id);
                setVisiveis(next);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ring-1 ring-inset transition ${
                ativo
                  ? "bg-fill/10 text-ink ring-line/20"
                  : "bg-transparent text-ink-muted ring-line/10 line-through opacity-60"
              }`}
              aria-pressed={ativo}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: cor }}
                aria-hidden="true"
              />
              {NOMES_CURTOS[id] ?? nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}
