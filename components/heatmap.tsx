import { heatmap as heatmapMock, turnos, type LinhaHeatmap } from "@/lib/mock-data";

/** Verde (baixo) → âmbar → vermelho (alto). value 0-100. */
function corRisco(v: number) {
  const hue = 145 - (v / 100) * 145; // 145=verde, 0=vermelho
  const light = 38 + (v / 100) * 6;
  return `hsl(${hue} 62% ${light}%)`;
}

function nivelRotulo(v: number) {
  if (v >= 75) return "Crítico";
  if (v >= 55) return "Alto";
  if (v >= 35) return "Médio";
  return "Baixo";
}

/** Mapa de calor de risco psicossocial: Setor × Turno. */
export function Heatmap({ linhas = heatmapMock }: { linhas?: LinhaHeatmap[] }) {
  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-[520px]"
        role="img"
        aria-label="Mapa de calor de risco psicossocial por setor e turno. Passe o cursor em cada célula para ver o nível e o valor."
      >
        {/* Cabeçalho de turnos */}
        <div className="grid grid-cols-[150px_repeat(4,1fr)] gap-1.5">
          <div />
          {turnos.map((t) => (
            <div key={t} className="px-1 pb-2 text-center text-xs font-medium text-ink-muted">
              {t}
            </div>
          ))}
        </div>

        {/* Linhas por setor */}
        <div className="space-y-1.5">
          {linhas.map((linha) => (
            <div key={linha.setor} className="grid grid-cols-[150px_repeat(4,1fr)] items-center gap-1.5">
              <div className="truncate pr-2 text-sm text-ink">{linha.setor}</div>
              {linha.valores.map((v, i) => (
                <div
                  key={i}
                  className="group relative flex h-12 items-center justify-center rounded-lg text-sm font-semibold text-white/95 transition-transform hover:z-10 hover:scale-[1.06]"
                  style={{ backgroundColor: corRisco(v) }}
                  title={`${linha.setor} · ${turnos[i]} — ${nivelRotulo(v)} (${v})`}
                >
                  {v}
                  <span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-navy-deep px-2 py-1 text-[11px] text-ink ring-1 ring-line/10 group-hover:block">
                    {nivelRotulo(v)} · {turnos[i]}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-ink-muted">Baixo</span>
          <div className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, hsl(145 62% 40%), hsl(72 62% 41%), hsl(30 62% 42%), hsl(0 62% 44%))" }} />
          <span className="text-xs text-ink-muted">Crítico</span>
        </div>
      </div>
    </div>
  );
}
