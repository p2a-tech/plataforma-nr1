import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Card / Painel                                                              */
/* -------------------------------------------------------------------------- */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  hint,
  icon,
  action,
  className,
}: {
  children: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex items-start gap-2.5">
        {icon && <div className="mt-0.5 text-ia">{icon}</div>}
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight text-ink">{children}</h3>
          {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Badge / Pill                                                               */
/* -------------------------------------------------------------------------- */
type Tone = "ia" | "humano" | "ok" | "alerta" | "neutro" | "ambar";

const toneMap: Record<Tone, string> = {
  ia: "bg-ia/15 text-ia ring-1 ring-inset ring-ia/25",
  humano: "bg-humano/15 text-humano ring-1 ring-inset ring-humano/25",
  ambar: "bg-humano-soft/15 text-humano-soft ring-1 ring-inset ring-humano-soft/25",
  ok: "bg-ok/15 text-ok ring-1 ring-inset ring-ok/25",
  alerta: "bg-alerta/15 text-alerta ring-1 ring-inset ring-alerta/25",
  neutro: "bg-fill/5 text-ink-muted ring-1 ring-inset ring-line/10",
};

export function Badge({
  tone = "neutro",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn("tag", toneMap[tone], className)}>{children}</span>;
}

/* -------------------------------------------------------------------------- */
/*  Barra de progresso                                                         */
/* -------------------------------------------------------------------------- */
export function ProgressBar({
  value,
  tone = "ia",
  className,
}: {
  value: number;
  tone?: "ia" | "humano" | "ok";
  className?: string;
}) {
  const bar = { ia: "bg-ia", humano: "bg-humano", ok: "bg-ok" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-fill/8", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700", bar)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton (loading)                                                         */
/* -------------------------------------------------------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-fill/5", className)} />;
}

/* -------------------------------------------------------------------------- */
/*  Cabeçalho de página                                                        */
/* -------------------------------------------------------------------------- */
export function PageHeader({
  titulo,
  descricao,
  badge,
  acao,
}: {
  titulo: string;
  descricao?: string;
  badge?: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            {titulo}
          </h1>
          {badge}
        </div>
        {descricao && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}
