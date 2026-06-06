"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/layout/nav";
import { Logo } from "@/components/brand/logo";
import { P2ALogo } from "@/components/brand/p2a-logo";
import { empresa } from "@/lib/mock-data";
import { Building2 } from "lucide-react";

export function Sidebar({
  onNavigate,
  vidas,
  papel,
}: {
  onNavigate?: () => void;
  vidas?: number;
  papel?: "sst" | "clinica" | "admin" | "diretoria";
}) {
  const pathname = usePathname();
  const vidasLabel = (vidas ?? 0).toLocaleString("pt-BR");
  const itens = navItems.filter((i) => !i.papeis || (papel != null && i.papeis.includes(papel)));

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-line/5 bg-navy-deep/80">
      <div className="px-5 py-5">
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo size="md" withTagline />
        </Link>
      </div>

      {/* Empresa monitorada */}
      <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-line/5 bg-fill/[0.03] px-3 py-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-ia/10 text-ia">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-ink">{empresa.nome}</div>
          <div className="text-xs text-ink-muted">{vidasLabel} vidas · {empresa.unidades} unidades</div>
        </div>
      </div>

      <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-3">
        {itens.map((item) => {
          const ativo = pathname === item.href;
          const Icon = item.icon;
          const accent = item.ator === "clinica" ? "humano" : "ia";
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                ativo
                  ? "bg-fill/[0.06] text-ink"
                  : "text-ink-muted hover:bg-fill/[0.04] hover:text-ink",
              )}
            >
              {ativo && (
                <span
                  className={cn(
                    "absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full",
                    accent === "humano" ? "bg-humano" : "bg-ia",
                  )}
                />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  ativo
                    ? accent === "humano"
                      ? "text-humano"
                      : "text-ia"
                    : "text-ink-muted group-hover:text-ink",
                )}
              />
              <div className="min-w-0">
                <div className="truncate font-medium leading-tight">{item.label}</div>
                <div className="truncate text-[11px] text-ink-muted">{item.descricao}</div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Rodapé / convenção de cores */}
      <div className="border-t border-line/5 px-5 py-4">
        <div className="mb-2 flex items-center gap-4 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ia" /> IA / plataforma
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-humano" /> Clínica
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
          <span>uma solução</span>
          <P2ALogo size="xs" />
        </div>
      </div>
    </aside>
  );
}
