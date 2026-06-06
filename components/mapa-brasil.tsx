import { MapPin } from "lucide-react";
import { Card, CardTitle, Badge } from "@/components/ui/primitives";
import { OUTLINE, VB, type LocalMapa } from "@/lib/mapa-brasil";

/**
 * Mapa do Brasil em estilo HUD/holográfico (Diretoria): silhueta em ciano com
 * glow, grade wireframe, anéis orbitais e pontos pulsantes nas praças atendidas
 * conforme o filtro (empresa ou Global).
 */
export function MapaBrasil({ locais, label }: { locais: LocalMapa[]; label: string }) {
  const C = VB / 2;
  // grade (parDSalelos/meridianos) dentro do contorno
  const linhas = [];
  for (let v = 60; v < VB; v += 48) linhas.push(v);

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<MapPin className="h-5 w-5" />}
        hint={`Praças atendidas — ${label}`}
        action={<Badge tone="ia">{locais.length} cidades</Badge>}
      >
        Presença no Brasil
      </CardTitle>

      <div className="relative overflow-hidden rounded-2xl bg-[#04121d] ring-1 ring-inset ring-ia/10">
        {/* brilho radial de fundo + grade pontilhada (HUD) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(0,194,209,0.20),transparent_62%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,194,209,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,194,209,0.5) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        <svg viewBox={`0 0 ${VB} ${VB}`} className="relative mx-auto block h-auto w-full max-w-[460px]">
          <defs>
            <filter id="hudGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="brFill" cx="42%" cy="40%" r="75%">
              <stop offset="0%" stopColor="#7df3fb" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#13c6d8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#067a8a" stopOpacity="0.85" />
            </radialGradient>
            <clipPath id="brClip">
              <path d={OUTLINE} />
            </clipPath>
          </defs>

          {/* Anéis orbitais (HUD) */}
          <g fill="none" className="stroke-ia/25">
            <circle cx={C} cy={C} r={262} strokeDasharray="2 7" strokeWidth={1} />
            <ellipse cx={C} cy={C} rx={250} ry={92} strokeWidth={1.2} transform={`rotate(-22 ${C} ${C})`} />
            <ellipse cx={C} cy={C} rx={250} ry={92} strokeWidth={1} strokeDasharray="3 8" transform={`rotate(20 ${C} ${C})`} />
          </g>
          {/* marcações de "scanner" no anel */}
          <g className="stroke-ia/40" strokeWidth={2}>
            <line x1={C} y1={32} x2={C} y2={48} />
            <line x1={C} y1={VB - 48} x2={C} y2={VB - 32} />
            <line x1={38} y1={C} x2={54} y2={C} />
            <line x1={VB - 54} y1={C} x2={VB - 38} y2={C} />
          </g>

          {/* halo da silhueta */}
          <path d={OUTLINE} fill="none" className="stroke-ia/40" strokeWidth={7} filter="url(#hudGlow)" />
          {/* silhueta preenchida */}
          <path d={OUTLINE} fill="url(#brFill)" className="stroke-ia" strokeWidth={1.6} filter="url(#hudGlow)" />
          {/* grade wireframe dentro do Brasil */}
          <g clipPath="url(#brClip)" stroke="#04121d" strokeOpacity={0.45} strokeWidth={1}>
            {linhas.map((v) => (
              <line key={`h${v}`} x1={0} y1={v} x2={VB} y2={v} />
            ))}
            {linhas.map((v) => (
              <line key={`w${v}`} x1={v} y1={0} x2={v} y2={VB} />
            ))}
          </g>

          {/* Pontos pulsantes luminosos */}
          {locais.map((l) => {
            const r = 4.5 + Math.min(3.5, (l.empresas - 1) * 0.8);
            return (
              <g key={l.id} transform={`translate(${l.x.toFixed(1)},${l.y.toFixed(1)})`}>
                <circle
                  r={r + 3}
                  className="fill-ia/50 animate-ping"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
                <circle r={r + 2.5} className="fill-ia/25" filter="url(#hudGlow)" />
                <circle r={r} className="fill-[#aef6ff]" />
                <circle r={r} fill="none" className="stroke-white" strokeWidth={1} />
                <title>
                  {l.nome}/{l.uf} · {l.empresas} empresa(s)
                </title>
              </g>
            );
          })}
        </svg>

        {locais.length === 0 && (
          <p className="absolute inset-x-0 bottom-6 text-center text-sm text-ink-muted">
            Sem praças cadastradas neste escopo.
          </p>
        )}
      </div>
    </Card>
  );
}
