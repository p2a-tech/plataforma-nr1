import { Globe2 } from "lucide-react";
import { Card, CardTitle, Badge } from "@/components/ui/primitives";

/**
 * Globo terrestre girando em estilo HUD/holográfico (Diretoria).
 * Textura equiretangular (public/earth.jpg) rolando no eixo X (rotação),
 * tingida em ciano, com esfera/wireframe, glow e anéis orbitais.
 */
const CIANO = "sepia(1) hue-rotate(150deg) saturate(4.5) brightness(0.82) contrast(1.18)";

export function GloboHud({ label, cidades }: { label: string; cidades: number }) {
  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<Globe2 className="h-5 w-5" />}
        hint={`Cobertura — ${label}`}
        action={<Badge tone="ia">{cidades} cidades</Badge>}
      >
        Operação · Grupo GPS
      </CardTitle>

      <div className="relative grid place-items-center overflow-hidden rounded-2xl bg-[#03101a] py-10 ring-1 ring-inset ring-ia/15">
        {/* brilho radial + grade pontilhada */}
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_50%,rgba(0,194,209,0.22),transparent_60%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,194,209,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(0,194,209,0.5) 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative aspect-square w-[min(80%,360px)]">
          {/* anéis orbitais girando */}
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute -inset-[18%] h-[136%] w-[136%]">
            <g fill="none" className="stroke-ia/30">
              <ellipse cx="50" cy="50" rx="49" ry="17" strokeWidth="0.5" transform="rotate(-20 50 50)">
                <animateTransform attributeName="transform" type="rotate" from="-20 50 50" to="340 50 50" dur="24s" repeatCount="indefinite" />
              </ellipse>
              <ellipse cx="50" cy="50" rx="49" ry="17" strokeWidth="0.4" strokeDasharray="1.5 3" transform="rotate(22 50 50)">
                <animateTransform attributeName="transform" type="rotate" from="382 50 50" to="22 50 50" dur="34s" repeatCount="indefinite" />
              </ellipse>
              <circle cx="50" cy="50" r="49" strokeWidth="0.3" strokeDasharray="0.5 4" className="stroke-ia/40" />
            </g>
          </svg>

          {/* esfera (globo) */}
          <div className="relative h-full w-full overflow-hidden rounded-full ring-1 ring-ia/40 shadow-[0_0_70px_rgba(0,194,209,0.5)]">
            {/* fundo do oceano */}
            <div className="absolute inset-0 bg-[#021018]" />
            {/* textura da Terra girando (duas cópias para loop contínuo) */}
            <div className="absolute inset-0 flex w-[200%] animate-scroll-x">
              <img src="/earth.jpg" alt="" aria-hidden className="h-full w-1/2 object-cover" style={{ filter: CIANO }} />
              <img src="/earth.jpg" alt="" aria-hidden className="h-full w-1/2 object-cover" style={{ filter: CIANO }} />
            </div>
            {/* sombreamento da esfera + brilho especular */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 34% 28%, rgba(150,245,255,0.30), transparent 36%), radial-gradient(circle at 50% 50%, transparent 52%, rgba(2,10,18,0.9) 100%)",
              }}
            />
            {/* wireframe (meridianos e paralelos) */}
            <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
              <g fill="none" className="stroke-ia/25" strokeWidth="0.35">
                <circle cx="50" cy="50" r="49.6" className="stroke-ia/50" strokeWidth="0.6" />
                <ellipse cx="50" cy="50" rx="49.6" ry="16" />
                <ellipse cx="50" cy="50" rx="49.6" ry="32" />
                <line x1="0.4" y1="50" x2="99.6" y2="50" />
                <ellipse cx="50" cy="50" rx="16" ry="49.6" />
                <ellipse cx="50" cy="50" rx="32" ry="49.6" />
                <line x1="50" y1="0.4" x2="50" y2="99.6" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </Card>
  );
}
