import { cn } from "@/lib/utils";

/**
 * Logo do Grupo GPS — wordmark oficial.
 * Reproduz a marca: "GPS" em peso extra-bold (claro) seguido de um nome de
 * unidade em azul-claro itálico (ex.: "Jean"). Vetorial (texto), fundo
 * transparente, escalável. A plataforma PrevIA opera sob o Grupo GPS.
 *
 * Para trocar pelo PNG oficial: salve em `public/gps-logo.png` e use
 * <Image src="/gps-logo.png" .../> com `mix-blend-mode: screen` sobre fundos escuros.
 */

// Azul-claro do nome de unidade ("Jean") — tom cornflower do wordmark GPS.
const GPS_BLUE = "#5B9BD5";

const sizes = {
  xs: { gps: "text-[13px]", unit: "text-[12px] ml-0.5" },
  sm: { gps: "text-base", unit: "text-[15px] ml-0.5" },
  md: { gps: "text-2xl", unit: "text-[22px] ml-1" },
  lg: { gps: "text-4xl", unit: "text-[34px] ml-1" },
} as const;

export function GpsLogo({
  size = "sm",
  unit = "",
  className,
}: {
  size?: keyof typeof sizes;
  /** Nome opcional de unidade em azul-claro itálico ao lado de "GPS" (vazio = só "GPS"). */
  unit?: string;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <span
      className={cn("inline-flex items-baseline font-brand leading-none", className)}
    >
      <span className={cn("font-extrabold tracking-tight text-ink", s.gps)}>GPS</span>
      {unit && (
        <span
          className={cn("font-medium italic tracking-tight", s.unit)}
          style={{ color: GPS_BLUE }}
        >
          {unit}
        </span>
      )}
    </span>
  );
}
