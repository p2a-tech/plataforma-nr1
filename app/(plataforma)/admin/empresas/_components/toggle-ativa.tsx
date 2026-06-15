"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Switch ativar/desativar empresa. PATCH /api/admin/empresas/[id] { ativa }.
 */
export function ToggleAtiva({ id, inicial }: { id: string; inicial: boolean }) {
  const router = useRouter();
  const [ativa, setAtiva] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onToggle() {
    const novo = !ativa;
    setAtiva(novo);
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/empresas/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ativa: novo }),
      });
      if (!res.ok) {
        setAtiva(!novo);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setAtiva(!novo);
    } finally {
      setSalvando(false);
    }
  }

  const busy = salvando || pending;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      role="switch"
      aria-checked={ativa}
      aria-label={ativa ? "Desativar empresa" : "Ativar empresa"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
        ativa
          ? "bg-ok/15 text-ok ring-ok/25 hover:bg-ok/20"
          : "bg-fill/5 text-ink-muted ring-line/10 hover:bg-fill/10",
        busy && "opacity-60",
      )}
    >
      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      {ativa ? "Ativa" : "Inativa"}
    </button>
  );
}
