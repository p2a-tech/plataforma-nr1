"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, ChevronDown, Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { navItems } from "@/components/layout/nav";
import type { UsuarioSessao } from "@/components/layout/shell";

const PAPEL_LABEL: Record<UsuarioSessao["papel"], string> = {
  sst: "Gestor SST",
  clinica: "Clínica Parceira",
  admin: "Admin P2A",
};

function iniciaisDe(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "PA";
}

export function Header({
  onOpenMenu,
  usuario,
}: {
  onOpenMenu: () => void;
  usuario?: UsuarioSessao;
}) {
  const { tema, toggleTema } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const tituloAtual = navItems.find((n) => n.href === pathname)?.label ?? "PrevIA";
  const nome = usuario?.nome ?? "Usuário";
  const papelLabel = usuario ? PAPEL_LABEL[usuario.papel] : "—";

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const sair = async () => {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line/5 bg-navy/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMenu}
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-fill/5 hover:text-ink lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden md:block">
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">PrevIA · Painel</div>
          <div className="font-display text-base font-semibold text-ink">{tituloAtual}</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={toggleTema}
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted ring-1 ring-inset ring-line/10 transition-colors hover:bg-fill/5 hover:text-ink"
          aria-label={tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          title={tema === "dark" ? "Tema claro" : "Tema escuro"}
        >
          {tema === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        {/* Usuário autenticado */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setAberto((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-line/5 bg-fill/[0.03] py-1.5 pl-1.5 pr-2.5 hover:bg-fill/[0.06]"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-ia/30 to-humano/30 text-xs font-semibold text-ink">
              {iniciaisDe(nome)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-ink">{nome}</span>
              <span className="block text-[11px] leading-tight text-ink-muted">{papelLabel}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-ink-muted" />
          </button>

          {aberto && (
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-line/10 bg-navy-panel shadow-panel">
              <div className="border-b border-line/5 px-3 py-2.5">
                <div className="text-sm font-medium text-ink">{nome}</div>
                <div className="text-[11px] text-ink-muted">{usuario?.email}</div>
              </div>
              <button
                onClick={sair}
                className="flex w-full items-center gap-2 border-t border-line/5 px-3 py-2.5 text-left text-sm text-humano hover:bg-fill/5"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
