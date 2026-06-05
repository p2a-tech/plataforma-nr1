import { cn } from "@/lib/utils";
import { brand } from "@/lib/mock-data";

/** Logo textual PrevIA com marca de radar. Tamanhos: sm | md | lg */
export function Logo({
  size = "md",
  withTagline = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  withTagline?: boolean;
  className?: string;
}) {
  const dims = {
    sm: { mark: "h-7 w-7", text: "text-lg", tag: "text-[10px]" },
    md: { mark: "h-9 w-9", text: "text-2xl", tag: "text-[11px]" },
    lg: { mark: "h-14 w-14", text: "text-4xl", tag: "text-sm" },
  }[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <RadarMark className={dims.mark} />
      <div className="leading-none">
        <div className={cn("font-display font-semibold tracking-tight text-ink", dims.text)}>
          Prev<span className="text-ia">IA</span>
        </div>
        {withTagline && (
          <div className={cn("mt-1 font-medium uppercase tracking-[0.18em] text-ink-muted", dims.tag)}>
            {brand.tagline}
          </div>
        )}
      </div>
    </div>
  );
}

/** Símbolo circular de radar (círculos concêntricos + ponto). */
export function RadarMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-xl bg-navy-deep ring-1 ring-ia/30",
        className,
      )}
    >
      <svg viewBox="0 0 40 40" className="h-[70%] w-[70%]">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#00C2D1" strokeOpacity="0.25" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="10" fill="none" stroke="#00C2D1" strokeOpacity="0.5" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="4" fill="#00C2D1" />
        <path d="M20 20 L34 12" stroke="#FF6B35" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}
