"use client";

/**
 * Error boundary da área da plataforma. Renderiza dentro do Shell/layout,
 * então pode usar os primitives e tokens do tema normalmente.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import { Card } from "@/components/ui/primitives";

export default function PlataformaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="flex max-w-md flex-col items-center gap-4 py-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-alerta/10 ring-1 ring-inset ring-alerta/25">
          <AlertTriangle className="h-7 w-7 text-alerta" />
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
            Não foi possível carregar esta seção
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
            Ocorreu um erro inesperado. Você pode tentar novamente ou voltar para
            o painel principal.
          </p>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 rounded-xl border border-ia/25 bg-ia/10 px-4 py-2.5 text-sm font-medium text-ia transition hover:bg-ia/20"
          >
            <RotateCcw className="h-4 w-4" />
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl border border-line/10 bg-fill/[0.03] px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-fill/[0.06] hover:text-ink"
          >
            <LayoutDashboard className="h-4 w-4" />
            Voltar ao dashboard
          </Link>
        </div>

        {error?.digest && (
          <p className="mt-1 text-[11px] text-ink-muted">
            Código de referência: {error.digest}
          </p>
        )}
      </Card>
    </div>
  );
}
