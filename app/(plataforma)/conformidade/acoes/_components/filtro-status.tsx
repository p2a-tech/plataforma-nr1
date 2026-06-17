"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { StatusPlano } from "@/lib/plano-acao";

/**
 * Filtro por status do quadro de acompanhamento (Onda 9).
 *
 * Client island que escreve o filtro na query string (?status=...) e dá
 * router.refresh() — a página server relê searchParams e re-filtra a lista.
 * Usa pathname + push em vez de useSearchParams para evitar a exigência de
 * <Suspense> no prerender (a página passa o valor atual via prop).
 */

const OPCOES: { value: StatusPlano | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export function FiltroStatus({ atual }: { atual: StatusPlano | "todos" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function selecionar(valor: StatusPlano | "todos") {
    const url = valor === "todos" ? pathname : `${pathname}?status=${valor}`;
    startTransition(() => router.push(url));
  }

  return (
    <div
      className={cn("flex flex-wrap gap-1.5", pending && "opacity-70")}
      role="group"
      aria-label="Filtrar por status"
    >
      {OPCOES.map((o) => {
        const ativo = o.value === atual;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={ativo}
            onClick={() => selecionar(o.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition",
              ativo
                ? "bg-ia/15 text-ia ring-ia/30"
                : "bg-fill/5 text-ink-muted ring-line/10 hover:bg-fill/10 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
