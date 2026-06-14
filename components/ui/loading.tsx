import { Skeleton } from "@/components/ui/primitives";

/**
 * Skeletons de carregamento para as telas SST/Admin.
 * Server-friendly (sem hooks) — espelham o layout real pra evitar CLS.
 *
 * Convenções:
 *   - <PageSkeleton> = cabeçalho padrão (título + descrição + badge).
 *   - <DashboardSkeleton> = cabeçalho + grade 6 cards + 2 painéis largos.
 *   - <TableSkeleton rows> = cabeçalho + filtros + tabela de N linhas.
 *   - <HeatmapSkeleton> = cabeçalho + matriz setor × turno.
 */

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-72 max-w-full md:h-9 md:w-96" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-8 w-36" />
    </div>
  );
}

/** Estado vazio com apenas o cabeçalho — bom para páginas mais simples. */
export function PageSkeleton({ titulo }: { titulo?: string }) {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="panel space-y-3 p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className="panel space-y-3 p-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-72 max-w-full" />
        <Skeleton className="h-48 w-full" />
        {titulo ? null : null}
      </div>
    </div>
  );
}

/** Cabeçalho + 6 cards de métrica + 2 painéis (espelha /dashboard). */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel space-y-3 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="panel space-y-4 p-5 lg:col-span-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3 w-72 max-w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="panel space-y-4 p-5 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-52 max-w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

/** Cabeçalho + filtros + tabela. Use para /admin/leads e listagens. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      {/* Cards de funil (até 5) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="panel space-y-3 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Filtros */}
      <div className="panel space-y-3 p-5">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
      {/* Tabela */}
      <div className="panel space-y-3 p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Cabeçalho + grade que parece um heatmap (linhas x colunas). */
export function HeatmapSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="panel space-y-4 p-5 lg:col-span-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3 w-64 max-w-full" />
          {/* Matriz pseudo setor × turno */}
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-5 gap-1.5">
                <Skeleton className="h-9 w-full col-span-1" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="panel space-y-3 p-5 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
