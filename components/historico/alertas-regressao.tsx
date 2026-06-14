import { AlertTriangle, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { alertasRegressao } from "@/lib/drps-historico";

/**
 * AlertasRegressao — server component. Renderiza cards verticais para cada
 * dimensão que piorou > 0.5 pontos entre os 2 ciclos consecutivos mais recentes.
 *
 * Onda 5 · §8 do BACKLOG. Quando não há regressão (caminho feliz), mostra
 * estado neutro encorajador. Para evitar buscar a série 2x na mesma página,
 * `historico/page.tsx` poderia passar a série pronta — mantemos auto-contido
 * por simplicidade.
 */
export async function AlertasRegressao({ empresaId }: { empresaId: string }) {
  const alertas = await alertasRegressao(empresaId);

  if (alertas.length === 0) {
    return (
      <div className="rounded-xl border border-line/10 bg-fill/5 p-5 text-center">
        <TrendingDown className="mx-auto h-5 w-5 text-ok" />
        <p className="mt-2 text-sm text-ink">
          Sem regressões detectadas entre os 2 ciclos mais recentes.
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Critério: delta de média &gt; 0,5 pontos (BACKLOG §8).
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {alertas.map((a) => (
        <Card key={a.dim_id} className="border-alerta/30 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-alerta" />
            <h4 className="font-display text-sm font-semibold text-ink">
              {a.dim_nome}
            </h4>
          </div>
          <div className="text-xs text-ink-muted">
            <strong className="text-ink/85">{a.cicloAnterior}</strong>:{" "}
            {a.mediaAnterior.toFixed(2)} →{" "}
            <strong className="text-alerta">{a.cicloAtual}</strong>:{" "}
            {a.mediaAtual.toFixed(2)}
          </div>
          <div className="mt-2 text-sm font-semibold text-alerta">
            +{a.delta.toFixed(2)} pontos
          </div>
          <div className="mt-1 text-[11px] text-ink-muted">
            Regressão detectada — recomenda-se revisão das ações do programa
            referente a esta dimensão.
          </div>
        </Card>
      ))}
    </div>
  );
}
