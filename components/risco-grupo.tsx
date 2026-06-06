import { Flame } from "lucide-react";
import { Card, CardTitle, Badge, ProgressBar } from "@/components/ui/primitives";
import type { EmpresaRiscoAlto } from "@/lib/grupo-risco";

/**
 * Bloco consolidado (Diretoria/Global): empresas do grupo em risco alto e os
 * setores mais críticos de cada uma. Renderizado só quando o escopo é Global.
 */
export function RiscoGrupo({ data }: { data: EmpresaRiscoAlto[] }) {
  return (
    <Card>
      <CardTitle
        icon={<Flame className="h-4 w-4 text-humano" />}
        hint="Empresas do grupo no nível alto/crítico e seus setores mais críticos (k≥7) — consolidado"
      >
        Empresas em risco alto · por setor
      </CardTitle>

      {data.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nenhuma empresa em risco alto no momento no consolidado do grupo. 🎉
        </p>
      ) : (
        <div className="space-y-4">
          {data.map((e) => (
            <div key={e.id} className="border-b border-line/5 pb-4 last:border-0 last:pb-0">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium text-ink">{e.nome}</span>
                  <span className="ml-2 text-xs text-ink-muted">{e.segmento}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-display text-lg font-semibold text-ink">{e.risco}</span>
                  <Badge tone={e.critico ? "alerta" : "humano"}>{e.critico ? "Crítico" : "Alto"}</Badge>
                </div>
              </div>
              <ProgressBar value={e.risco} tone="humano" />
              {e.setores.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-ink-muted">Setores críticos:</span>
                  {e.setores.map((s) => (
                    <span
                      key={s.setor}
                      className="inline-flex items-center gap-1 rounded-full bg-humano/10 px-2 py-0.5 text-[11px] text-humano ring-1 ring-inset ring-humano/25"
                    >
                      {s.setor} <b>{s.risco}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
