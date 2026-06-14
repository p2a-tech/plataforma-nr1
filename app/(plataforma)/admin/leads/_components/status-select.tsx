"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "novo" | "contatado" | "qualificado" | "perdido" | "convertido";

const OPCOES: { value: Status; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "contatado", label: "Contatado" },
  { value: "qualificado", label: "Qualificado" },
  { value: "convertido", label: "Convertido" },
  { value: "perdido", label: "Perdido" },
];

/**
 * Select inline para mudar o status de um lead. Cliente porque precisa
 * de evento de mudança + fetch + refresh do RSC payload pra atualizar a tabela.
 */
export function StatusSelect({
  id,
  inicial,
  className,
}: {
  id: string;
  inicial: Status;
  className?: string;
}) {
  const router = useRouter();
  const [valor, setValor] = useState<Status>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [salvando, setSalvando] = useState(false);

  async function onChange(novo: Status) {
    if (novo === valor) return;
    const anterior = valor;
    setValor(novo);
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: novo }),
      });
      if (!res.ok) {
        setValor(anterior);
        setErro("Falha ao salvar");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setValor(anterior);
      setErro("Sem conexão");
    } finally {
      setSalvando(false);
    }
  }

  const busy = pending || salvando;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label className="sr-only" htmlFor={`status-${id}`}>
        Status do lead
      </label>
      <select
        id={`status-${id}`}
        value={valor}
        disabled={busy}
        onChange={(e) => onChange(e.target.value as Status)}
        className={cn(
          "rounded-lg border border-line/15 bg-fill/5 px-2.5 py-1 text-xs text-ink",
          "focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20",
          busy && "opacity-60",
        )}
      >
        {OPCOES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" aria-hidden="true" />}
      {erro && (
        <span className="text-[11px] text-alerta" role="alert">
          {erro}
        </span>
      )}
    </div>
  );
}
