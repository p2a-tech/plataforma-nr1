/**
 * Página 404 global. Server component, com a marca PrevIA e estilo do tema.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="bg-app flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo size="lg" withTagline />

      <div className="mt-10 font-display text-6xl font-semibold tracking-tight text-ia md:text-7xl">
        404
      </div>

      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">
        Página não encontrada
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        O endereço que você tentou acessar não existe ou foi movido. Verifique o
        link ou volte para o painel.
      </p>

      <Link
        href="/dashboard"
        className="mt-8 flex items-center gap-2 rounded-xl border border-ia/25 bg-ia/10 px-5 py-2.5 text-sm font-medium text-ia transition hover:bg-ia/20"
      >
        Voltar ao dashboard
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </main>
  );
}
