"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Play, Square, ChevronDown, Check, Search, Bell, Sun, Moon, LogOut, Building2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-state";
import { useTheme } from "@/lib/theme";
import { navItems } from "@/components/layout/nav";
import type { UsuarioSessao, SeletorEmpresa } from "@/components/layout/shell";

const PAPEL_LABEL: Record<UsuarioSessao["papel"], string> = {
  sst: "Gestor SST",
  clinica: "Clínica Parceira",
  diretoria: "Diretoria GPS",
  admin: "Admin P2A",
};
const DEMO: { papel: UsuarioSessao["papel"]; email: string }[] = [
  { papel: "sst", email: "gestor@translog.com.br" },
  { papel: "clinica", email: "clinica@translog.com.br" },
  { papel: "diretoria", email: "diretoria@gps.com.br" },
  { papel: "admin", email: "admin@p2a.tech" },
];

function iniciaisDe(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "PA";
}

export function Header({
  onOpenMenu,
  usuario,
  seletor,
}: {
  onOpenMenu: () => void;
  usuario?: UsuarioSessao;
  seletor?: SeletorEmpresa;
}) {
  const { apresentando, toggleApresentacao } = useApp();
  const { tema, toggleTema } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [escAberto, setEscAberto] = useState(false);
  const escRef = useRef<HTMLDivElement>(null);

  const trocarEscopo = async (empresa: string) => {
    setEscAberto(false);
    const r = await fetch("/api/escopo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ empresa }),
    });
    if (r.ok) router.refresh();
  };

  const tituloAtual = navItems.find((n) => n.href === pathname)?.label ?? "PrevIA";
  const nome = usuario?.nome ?? "Usuário";
  const papelLabel = usuario ? PAPEL_LABEL[usuario.papel] : "—";

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
      if (escRef.current && !escRef.current.contains(e.target as Node)) setEscAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const sair = async () => {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  };

  const trocarPapel = async (email: string) => {
    setAberto(false);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, senha: "previa123" }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      router.push(j.redirect ?? "/dashboard");
      router.refresh();
    }
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

        {/* Seletor de empresa (Diretoria): Global ou empresa específica */}
        {seletor && (
          <div className="relative" ref={escRef}>
            <button
              onClick={() => setEscAberto((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-ia/25 bg-ia/10 px-3 py-2 text-sm text-ink transition-colors hover:bg-ia/15"
              title="Trocar empresa em foco"
            >
              {seletor.atual === "global" ? (
                <Globe className="h-4 w-4 text-ia" />
              ) : (
                <Building2 className="h-4 w-4 text-ia" />
              )}
              <span className="hidden max-w-[160px] truncate font-medium sm:block">{seletor.label}</span>
              <ChevronDown className="h-4 w-4 text-ink-muted" />
            </button>
            {escAberto && (
              <div className="absolute left-0 z-40 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-line/10 bg-navy-panel shadow-panel">
                <div className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wider text-ink-muted">
                  Empresa em foco
                </div>
                <button
                  onClick={() => trocarEscopo("global")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-fill/5"
                >
                  <Globe className="h-4 w-4 text-ia" />
                  <span className="flex-1">Grupo GPS · consolidado</span>
                  {seletor.atual === "global" && <Check className="h-4 w-4 text-ia" />}
                </button>
                <div className="my-1 border-t border-line/5" />
                {seletor.opcoes.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => trocarEscopo(o.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-fill/5"
                  >
                    <Building2 className="h-4 w-4 text-ink-muted" />
                    <span className="flex-1 truncate">{o.nome}</span>
                    {seletor.atual === o.id && <Check className="h-4 w-4 text-ia" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="hidden flex-1 justify-center px-6 lg:flex">
        <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-line/5 bg-fill/[0.03] px-3 py-2 text-sm text-ink-muted">
          <Search className="h-4 w-4" />
          <span>Buscar setor, alerta ou evidência…</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleApresentacao}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all",
            apresentando
              ? "bg-humano text-white shadow-glowHuman"
              : "bg-ia/15 text-ia ring-1 ring-inset ring-ia/25 hover:bg-ia/25",
          )}
        >
          {apresentando ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span className="hidden sm:inline">{apresentando ? "Parar tour" : "Modo apresentação"}</span>
        </button>

        <button
          onClick={toggleTema}
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted ring-1 ring-inset ring-line/10 transition-colors hover:bg-fill/5 hover:text-ink"
          aria-label={tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          title={tema === "dark" ? "Tema claro" : "Tema escuro"}
        >
          {tema === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <button
          className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-fill/5 hover:text-ink"
          aria-label="Notificações"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-humano" />
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
              <div className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wider text-ink-muted">
                Trocar papel (demo)
              </div>
              {DEMO.map((d) => (
                <button
                  key={d.papel}
                  onClick={() => trocarPapel(d.email)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-fill/5"
                >
                  <span className="flex-1 text-sm text-ink">{PAPEL_LABEL[d.papel]}</span>
                  {usuario?.papel === d.papel && <Check className="h-4 w-4 text-ia" />}
                </button>
              ))}
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
