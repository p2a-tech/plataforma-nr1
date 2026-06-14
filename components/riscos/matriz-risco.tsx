import { Card, CardTitle, Badge } from "@/components/ui/primitives";
import { Grid3x3 } from "lucide-react";
import {
  MATRIZ_3x3,
  rotuloProbabilidade,
  rotuloImpacto,
  type Probabilidade,
  type Impacto,
} from "@/lib/matriz-risco";
import {
  toneClassificacao,
  rotuloClassificacao,
  type Classificacao,
} from "@/lib/drps-escoragem";

/**
 * <MatrizRisco /> · Onda 4 · §4 do BACKLOG_OKEBAMBO.
 *
 * Server component. Recebe a contagem de fatores por célula (prob × impacto)
 * e renderiza a matriz 3×3 com cor da classificação + número de fatores +
 * tooltip com lista de fatores.
 *
 * Cores aderentes à paleta da plataforma:
 *   baixo → ok (verde) · moderado → ambar/humano-soft · alto → alerta (vermelho).
 */

export interface FatorChip {
  id: string;
  nome: string;
}

export interface CelulaMatriz {
  prob: Probabilidade;
  impacto: Impacto;
  fatores: FatorChip[];
}

const corCelula: Record<Classificacao, string> = {
  baixo: "bg-ok/15 text-ok ring-1 ring-inset ring-ok/30",
  moderado: "bg-humano-soft/15 text-humano-soft ring-1 ring-inset ring-humano-soft/30",
  alto: "bg-alerta/15 text-alerta ring-1 ring-inset ring-alerta/30",
};

const corFundo: Record<Classificacao, string> = {
  baixo: "bg-ok/[0.05]",
  moderado: "bg-humano-soft/[0.06]",
  alto: "bg-alerta/[0.06]",
};

export function MatrizRisco({ celulas }: { celulas: CelulaMatriz[] }) {
  // Indexa as células por (prob,impacto) para acesso rápido.
  const idx = new Map<string, CelulaMatriz>();
  for (const c of celulas) idx.set(`${c.prob}|${c.impacto}`, c);

  const probsOrdenadas: Probabilidade[] = ["alta", "media", "baixa"];
  const impactosOrdenados: Impacto[] = ["baixo", "medio", "alto"];

  // Totais para o badge do título.
  const total = celulas.reduce((acc, c) => acc + c.fatores.length, 0);

  return (
    <Card>
      <CardTitle
        icon={<Grid3x3 className="h-5 w-5" />}
        hint="Probabilidade do ofensor × Impacto na saúde — célula colorida pela classificação NR-1"
        action={<Badge tone="ia">3 × 3 · {total} fatores</Badge>}
      >
        Matriz de risco psicossocial
      </CardTitle>

      <div className="overflow-x-auto">
        <div className="flex min-w-[420px] gap-2">
          {/* Rótulo vertical Y */}
          <div className="flex items-center">
            <span className="rotate-180 text-[11px] font-medium uppercase tracking-wider text-ink-muted [writing-mode:vertical-rl]">
              Probabilidade
            </span>
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-[80px_repeat(3,1fr)] gap-1.5">
              {/* Linhas */}
              {probsOrdenadas.map((prob) => (
                <LinhaMatriz
                  key={prob}
                  prob={prob}
                  impactosOrdenados={impactosOrdenados}
                  idx={idx}
                />
              ))}

              {/* Eixo X */}
              <div />
              {impactosOrdenados.map((imp) => (
                <div
                  key={imp}
                  className="pt-1 text-center text-[11px] font-medium uppercase tracking-wider text-ink-muted"
                >
                  {rotuloImpacto(imp)}
                </div>
              ))}
            </div>
            <div className="mt-1 text-center text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Impacto na saúde
            </div>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-ok/40 ring-1 ring-inset ring-ok/50" />
          <span className="text-ink-muted">Baixo</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-humano-soft/40 ring-1 ring-inset ring-humano-soft/50" />
          <span className="text-ink-muted">Moderado</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-alerta/40 ring-1 ring-inset ring-alerta/50" />
          <span className="text-ink-muted">Alto</span>
        </span>
      </div>
      <p className="mt-2 text-[11px] text-ink-muted/70">
        Células com amostra &lt; 7 omitidas (LGPD · k-anonimato).
      </p>
    </Card>
  );
}

function LinhaMatriz({
  prob,
  impactosOrdenados,
  idx,
}: {
  prob: Probabilidade;
  impactosOrdenados: Impacto[];
  idx: Map<string, CelulaMatriz>;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
        {rotuloProbabilidade(prob)}
      </div>
      {impactosOrdenados.map((imp) => {
        const cel = idx.get(`${prob}|${imp}`);
        const classe = MATRIZ_3x3.find((m) => m.prob === prob && m.impacto === imp)!.classe;
        const fatores = cel?.fatores ?? [];
        const n = fatores.length;
        const titulo =
          n > 0
            ? `${rotuloProbabilidade(prob)} × ${rotuloImpacto(imp)} (${rotuloClassificacao(classe)}) — ${fatores.map((f) => f.nome).join(", ")}`
            : `${rotuloProbabilidade(prob)} × ${rotuloImpacto(imp)} — ${rotuloClassificacao(classe)} (vazio)`;
        return (
          <div
            key={imp}
            className={`group relative flex min-h-[5rem] flex-col items-center justify-center gap-1 rounded-xl p-2 transition-transform hover:z-10 hover:scale-[1.04] ${corFundo[classe]}`}
            title={titulo}
            aria-label={titulo}
          >
            <div className={`tag !px-2 !py-0.5 ${corCelula[classe]}`}>
              {rotuloClassificacao(classe)}
            </div>
            <div className="text-lg font-display font-semibold leading-none text-ink">
              {n}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">
              {n === 1 ? "fator" : "fatores"}
            </div>
          </div>
        );
      })}
    </>
  );
}
