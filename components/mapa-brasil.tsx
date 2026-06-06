import { MapPin } from "lucide-react";
import { Card, CardTitle, Badge } from "@/components/ui/primitives";
import { OUTLINE, VB, type LocalMapa } from "@/lib/mapa-brasil";

/**
 * Mapa do Brasil em estilo HUD/holográfico (Diretoria): silhueta ciano com glow
 * intenso, grade wireframe, anéis orbitais girando, varredura de radar e pontos
 * pulsantes nas praças. Comportamento por filtro (empresa ou Global).
 */
export function MapaBrasil({ locais, label }: { locais: LocalMapa[]; label: string }) {
  const C = VB / 2;
  const linhas: number[] = [];
  for (let v = 60; v < VB; v += 46) linhas.push(v);
  const rot = (from: string, to: string, dur: string) => (
    <animateTransform
      attributeName="transform"
      attributeType="XML"
      type="rotate"
      from={from}
      to={to}
      dur={dur}
      repeatCount="indefinite"
    />
  );

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
        {/* brilho radial pulsante + grade pontilhada */}
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_46%,rgba(0,194,209,0.30),transparent_60%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,194,209,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,194,209,0.5) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        {/* varredura de radar (conic) girando */}
        <div
          className="pointer-events-none absolute left-1/2 top-[46%] aspect-square w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full animate-spin [animation-duration:7s]"
          style={{ background: "conic-gradient(from 0deg, rgba(0,194,209,0.35), rgba(0,194,209,0.04) 22%, transparent 38%)" }}
        />

        <svg viewBox={`0 0 ${VB} ${VB}`} className="relative mx-auto block h-auto w-full max-w-[460px]">
          <defs>
            <filter id="hudGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="hudGlowSoft" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <radialGradient id="brFill" cx="42%" cy="38%" r="78%">
              <stop offset="0%" stopColor="#a9f7ff" stopOpacity="1" />
              <stop offset="50%" stopColor="#1ad0e2" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#067a8a" stopOpacity="0.85" />
            </radialGradient>
            <clipPath id="brClip">
              <path d={OUTLINE} />
            </clipPath>
          </defs>

          {/* Anéis orbitais girando (sentidos opostos) */}
          <g fill="none" className="stroke-ia/35">
            <circle cx={C} cy={C} r={266} strokeDasharray="2 8" strokeWidth={1.2} />
            <ellipse cx={C} cy={C} rx={255} ry={94} strokeWidth={1.4} transform={`rotate(-22 ${C} ${C})`} />
            {rot(`0 ${C} ${C}`, `360 ${C} ${C}`, "46s")}
          </g>
          <g fill="none" className="stroke-ia/25">
            <ellipse cx={C} cy={C} rx={255} ry={94} strokeWidth={1.1} strokeDasharray="4 9" transform={`rotate(24 ${C} ${C})`} />
            {rot(`360 ${C} ${C}`, `0 ${C} ${C}`, "32s")}
          </g>
          {/* marcações de scanner no anel externo (giro lento) */}
          <g className="stroke-ia/50" strokeWidth={2.5}>
            <line x1={C} y1={26} x2={C} y2={50} />
            <line x1={C} y1={VB - 50} x2={C} y2={VB - 26} />
            <line x1={32} y1={C} x2={56} y2={C} />
            <line x1={VB - 56} y1={C} x2={VB - 32} y2={C} />
            {rot(`0 ${C} ${C}`, `360 ${C} ${C}`, "60s")}
          </g>

          {/* halo difuso + halo de traço (glow intenso) */}
          <path d={OUTLINE} className="fill-ia/40" filter="url(#hudGlowSoft)" />
          <path d={OUTLINE} fill="none" className="stroke-ia/60" strokeWidth={9} filter="url(#hudGlow)" />
          {/* silhueta preenchida */}
          <path d={OUTLINE} fill="url(#brFill)" className="stroke-ia" strokeWidth={1.8} filter="url(#hudGlow)" />
          {/* grade wireframe dentro do Brasil */}
          <g clipPath="url(#brClip)" stroke="#03101a" strokeOpacity={0.45} strokeWidth={1}>
            {linhas.map((v) => (
              <line key={`h${v}`} x1={0} y1={v} x2={VB} y2={v} />
            ))}
            {linhas.map((v) => (
              <line key={`w${v}`} x1={v} y1={0} x2={v} y2={VB} />
            ))}
          </g>

          {/* Pontos pulsantes luminosos (duplo pulso) */}
          {locais.map((l) => {
            const r = 4.5 + Math.min(3.5, (l.empresas - 1) * 0.8);
            return (
              <g
                key={l.id}
                transform={`translate(${l.x.toFixed(1)},${l.y.toFixed(1)})`}
                aria-label={`${l.nome}/${l.uf} · ${l.empresas} empresa(s)`}
              >
                <circle
                  r={r + 6}
                  className="fill-ia/40 animate-ping"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
                <circle
                  r={r + 3}
                  className="fill-ia/40 animate-ping [animation-delay:0.7s]"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
                <circle r={r + 4} className="fill-ia/40" filter="url(#hudGlow)" />
                <circle r={r} className="fill-[#cffbff]" />
                <circle r={r} fill="none" className="stroke-white" strokeWidth={1.2} />
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
