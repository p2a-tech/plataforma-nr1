"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";

export interface UsuarioSessao {
  nome: string;
  papel: "sst" | "clinica" | "admin";
  email: string;
}

export function Shell({
  children,
  vidas,
  usuario,
}: {
  children: React.ReactNode;
  vidas?: number;
  usuario?: UsuarioSessao;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const pathname = usePathname();

  // Fecha o drawer ao trocar de rota
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden lg:block">
        <Sidebar vidas={vidas} />
      </div>

      {/* Drawer mobile */}
      {menuAberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuAberto(false)}
          />
          <div className="absolute left-0 top-0 h-full animate-fade-up">
            <button
              onClick={() => setMenuAberto(false)}
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg bg-fill/5 text-ink"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar vidas={vidas} onNavigate={() => setMenuAberto(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMenu={() => setMenuAberto(true)} usuario={usuario} />

        <main className={cn("flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8")}>
          <div key={pathname} className="mx-auto max-w-7xl animate-fade-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
