"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";

/** Barra fina indicando a clínica autenticada + logout. */
export function SessaoBar({ clinicaId, nome }: { clinicaId: string; nome: string }) {
  const router = useRouter();

  const sair = async () => {
    await fetch("/api/auth/clinica", { method: "DELETE" });
    router.push("/login-clinica");
    router.refresh();
  };

  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-humano/20 bg-humano/[0.06] px-4 py-2.5">
      <div className="flex items-center gap-2.5 text-sm">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-humano/15 text-humano">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <span className="text-ink">
          Sessão autenticada · <span className="font-medium">{nome}</span>
        </span>
        <span className="hidden font-mono text-[11px] text-ink-muted sm:inline">({clinicaId})</span>
      </div>
      <button
        onClick={sair}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-ink-muted transition hover:bg-fill/5 hover:text-ink"
      >
        <LogOut className="h-3.5 w-3.5" /> Sair
      </button>
    </div>
  );
}
