import { MapPin } from "lucide-react";
import { Card, CardTitle, Badge } from "@/components/ui/primitives";
import { OUTLINE, VB, type LocalMapa } from "@/lib/mapa-brasil";

/**
 * Mapa do Brasil em estilo HUD (Diretoria, escopo de UMA empresa): silhueta
 * ciano com glow, grade wireframe, anéis e PONTOS piscantes nas praças da
 * empresa selecionada. Entra com animação de "aproximação" (zoom-in).
 */
export function MapaBrasil({ locais, label }: { locais: LocalMapa[]; label: string }) {
  const C = VB / 2;
  const linhas: number[] = [];
  for (let v = 60; v < VB; v += 46) linhas.push(v);

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<MapPin className="h-5 w-5" />}
        hint={`Praças atendidas — ${label}`}
        action={<Badge tone="ia">{locais.length} cidades</Badge>}
      >
        Presença no Brasil
      </CardTitle>

      <div className="relative overflow-hidden rounded-2xl bg-[#03101a] ring-1 ring-inset ring-ia/15">
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_46%,rgba(0,194,209,0.28),transparent_60%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,194,209,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(0,194,209,0.5) 1px,transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        <svg viewBox={`0 0 ${VB} ${VB}`} className="relative mx-auto block h-auto w-full max-w-[460px] animate-zoom-in">
          <defs>
            <filter id="brGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="brGlowSoft" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <radialGradient id="brFill2" cx="42%" cy="38%" r="78%">
              <stop offset="0%" stopColor="#a9f7ff" stopOpacity="1" />
              <stop offset="50%" stopColor="#1ad0e2" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#067a8a" stopOpacity="0.85" />
            </radialGradient>
            <clipPath id="brClip2">
              <path d={OUTLINE} />
            </clipPath>
          </defs>

          {/* anéis girando */}
          <g fill="none" className="stroke-ia/30">
            <circle cx={C} cy={C} r={266} strokeDasharray="2 8" strokeWidth={1.2} />
            <ellipse cx={C} cy={C} rx={255} ry={94} strokeWidth={1.4} transform={`rotate(-22 ${C} ${C})`}>
              <animateTransform attributeName="transform" type="rotate" from={`-22 ${C} ${C}`} to={`338 ${C} ${C}`} dur="42s" repeatCount="indefinite" />
            </ellipse>
          </g>

          {/* halos + silhueta */}
          <path d={OUTLINE} className="fill-ia/40" filter="url(#brGlowSoft)" />
          <path d={OUTLINE} fill="none" className="stroke-ia/60" strokeWidth={9} filter="url(#brGlow)" />
          <path d={OUTLINE} fill="url(#brFill2)" className="stroke-ia" strokeWidth={1.8} filter="url(#brGlow)" />
          {/* grade wireframe */}
          <g clipPath="url(#brClip2)" stroke="#03101a" strokeOpacity={0.45} strokeWidth={1}>
            {linhas.map((v) => (
              <line key={`h${v}`} x1={0} y1={v} x2={VB} y2={v} />
            ))}
            {linhas.map((v) => (
              <line key={`w${v}`} x1={v} y1={0} x2={v} y2={VB} />
            ))}
          </g>

          {/* PONTOS piscantes nas praças da empresa */}
          {locais.map((l) => {
            const r = 5 + Math.min(3.5, (l.empresas - 1) * 0.8);
            return (
              <g
                key={l.id}
                transform={`translate(${l.x.toFixed(1)},${l.y.toFixed(1)})`}
                aria-label={`${l.nome}/${l.uf}`}
              >
                <circle r={r + 6} className="fill-ia/40 animate-ping" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                <circle r={r + 4} className="fill-ia/40" filter="url(#brGlow)" />
                <circle r={r} className="fill-[#cffbff]" />
                <circle r={r} fill="none" className="stroke-white" strokeWidth={1.2} />
              </g>
            );
          })}
        </svg>

        {locais.length === 0 && (
          <p className="absolute inset-x-0 bottom-6 text-center text-sm text-ink-muted">
            Sem praças cadastradas para esta empresa.
          </p>
        )}
      </div>
    </Card>
  );
}
