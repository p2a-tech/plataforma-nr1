import { cn } from "@/lib/utils";

/**
 * Logo da marca da casa — P2A Tech.
 * Reproduz o wordmark oficial: "P2A" em gradiente (ciano → azul → roxo → magenta)
 * seguido de "TECH" em claro. Vetorial (texto), fundo transparente, escalável.
 *
 * Para trocar pelo PNG oficial: salve o arquivo em `public/p2a-tech-logo.png`
 * e use <Image src="/p2a-tech-logo.png" .../> com `mix-blend-mode: screen`
 * (some o fundo escuro do PNG sobre superfícies escuras).
 */

const P2A_GRADIENT =
  "linear-gradient(95deg, #2FE6C9 0%, #22B8F0 24%, #3B7DF6 48%, #8B5CF6 72%, #E84AC2 100%)";

const sizes = {
  xs: { p2a: "text-[13px]", tech: "text-[8px] tracking-[0.2em] ml-1" },
  sm: { p2a: "text-base", tech: "text-[10px] tracking-[0.22em] ml-1.5" },
  md: { p2a: "text-2xl", tech: "text-xs tracking-[0.22em] ml-2" },
  lg: { p2a: "text-4xl", tech: "text-base tracking-[0.24em] ml-2.5" },
} as const;

export function P2ALogo({
  size = "sm",
  className,
}: {
  size?: keyof typeof sizes;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-brand font-extrabold uppercase leading-none",
        className,
      )}
    >
      <span
        className={cn("bg-clip-text text-transparent", s.p2a)}
        style={{
          backgroundImage: P2A_GRADIENT,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        P2A
      </span>
      <span className={cn("font-semibold text-ink/95", s.tech)}>Tech</span>
    </span>
  );
}
