import { MapPin } from "lucide-react";
import { Card, CardTitle, Badge } from "@/components/ui/primitives";
import { OUTLINE, VB, type LocalMapa } from "@/lib/mapa-brasil";

/**
 * Mapa do Brasil (Diretoria): silhueta no tema do sistema + pontos piscantes
 * nas cidades atendidas conforme o filtro (empresa ou Global).
 */
export function MapaBrasil({ locais, label }: { locais: LocalMapa[]; label: string }) {
  return (
    <Card>
      <CardTitle
        icon={<MapPin className="h-5 w-5" />}
        hint={`Praças atendidas — ${label}`}
        action={<Badge tone="ia">{locais.length} cidades</Badge>}
      >
        Presença no Brasil
      </CardTitle>

      <div className="relative">
        <svg viewBox={`0 0 ${VB} ${VB}`} className="mx-auto h-auto w-full max-w-[460px]">
          {/* Silhueta do Brasil — cores do sistema (ciano) */}
          <path
            d={OUTLINE}
            className="fill-ia/[0.06] stroke-ia/30"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* Pontos piscantes nas cidades atendidas */}
          {locais.map((l) => {
            const r = 4.5 + Math.min(3.5, (l.empresas - 1) * 0.8);
            return (
              <g key={l.id} transform={`translate(${l.x.toFixed(1)},${l.y.toFixed(1)})`}>
                <circle
                  r={r}
                  className="fill-ia/40 animate-ping"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
                <circle r={r} className="fill-ia" />
                <circle r={r} className="fill-none stroke-white/80" strokeWidth={0.8} />
                <title>
                  {l.nome}/{l.uf} · {l.empresas} empresa(s)
                </title>
              </g>
            );
          })}
        </svg>

        {locais.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-muted">Sem praças cadastradas neste escopo.</p>
        )}
      </div>
    </Card>
  );
}
