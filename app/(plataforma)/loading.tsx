/**
 * Skeleton de carregamento da área da plataforma. Server component — espelha o
 * layout do dashboard (faixa de cabeçalho + grade de cards de métrica + dois
 * painéis largos) para evitar "salto" de layout (CLS) durante o fetch.
 */

import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-72 max-w-full md:h-9 md:w-96" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>

      {/* Cards de métrica */}
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

      {/* Dois painéis largos */}
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
