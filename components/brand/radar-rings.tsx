import { cn } from "@/lib/utils";

/** Motivo decorativo de "ondas de radar" (círculos concêntricos animados). */
export function RadarRings({ className }: { className?: string }) {
  return (
    <div className={cn("radar-rings", className)} aria-hidden>
      <span />
      <span />
      <span />
    </div>
  );
}
