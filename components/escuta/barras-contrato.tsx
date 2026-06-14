import {
  rotuloClassificacao,
  type Classificacao,
} from "@/lib/drps-escoragem";
import type { AnalisePorContrato } from "@/lib/drps-analise";
import { Badge } from "@/components/ui/primitives";

/**
 * Barras horizontais por forma de contratação (CLT/PJ/Autônomo/Terceirizado/
 * Estágio). Destaca visualmente quando a média de um vínculo "alternativo"
 * (PJ/Autônomo) é maior que a do CLT — sinal vermelho pra fiscalização MPT.
 *
 * Server component — recebe a análise pronta. K-anonimato aplicado upstream
 * em `analisePorContrato`.
 */

function corBarra(c: Classificacao | null): string {
  switch (c) {
    case "baixo":
      return "bg-ok";
    case "moderado":
      return "bg-humano-soft";
    case "alto":
      return "bg-alerta";
    default:
      return "bg-fill/15";
  }
}

function badgeTone(c: Classificacao | null): "ok" | "ambar" | "alerta" | "neutro" {
  switch (c) {
    case "baixo":
      return "ok";
    case "moderado":
      return "ambar";
    case "alto":
      return "alerta";
    default:
      return "neutro";
  }
}

export function BarrasContrato({
  contratos,
}: {
  contratos: AnalisePorContrato[];
}) {
  if (contratos.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        Sem respostas para analisar por forma de contratação.
      </p>
    );
  }

  // Média do CLT (referência para destaque de alerta MPT).
  const clt = contratos.find(
    (c) => c.forma_atuacao.toLowerCase() === "clt" && !c.amostra_insuficiente,
  );
  const refClt = clt?.media ?? null;

  return (
    <div className="space-y-3">
      {contratos.map((c) => {
        const alertaMpt =
          refClt != null &&
          c.media != null &&
          !c.amostra_insuficiente &&
          c.forma_atuacao.toLowerCase() !== "clt" &&
          c.media > refClt + 0.5;

        const pct =
          c.media != null
            ? Math.min(100, Math.max(0, ((c.media - 1) / 4) * 100))
            : 0;

        return (
          <div
            key={c.forma_atuacao}
            className={
              "rounded-xl border border-line/10 bg-fill/5 p-3 " +
              (alertaMpt ? "ring-1 ring-inset ring-alerta/40" : "")
            }
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-ink">{c.forma_atuacao}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ink-muted">
                  n={c.n_respostas}
                </span>
                {c.amostra_insuficiente ? (
                  <Badge tone="neutro">amostra &lt;7</Badge>
                ) : (
                  <Badge tone={badgeTone(c.classificacao)}>
                    {c.media?.toFixed(2)} ·{" "}
                    {c.classificacao
                      ? rotuloClassificacao(c.classificacao)
                      : ""}
                  </Badge>
                )}
                {alertaMpt && <Badge tone="alerta">⚠ vs CLT</Badge>}
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-fill/8">
              <div
                className={
                  "h-full rounded-full transition-all duration-700 " +
                  corBarra(c.classificacao)
                }
                style={{
                  width: c.amostra_insuficiente ? "0%" : `${pct}%`,
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        Destaque vermelho aparece quando vínculo não-CLT tem média &gt; 0.5 ponto acima do CLT — sinal de fiscalização MPT (CDC art. 9º · isonomia de risco).
      </p>
    </div>
  );
}
