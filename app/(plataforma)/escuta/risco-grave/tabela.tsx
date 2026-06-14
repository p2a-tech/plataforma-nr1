"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertOctagon, Clock } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface EventoLinha {
  id: string;
  marcador_anonimo: string;
  tipo: string;
  tipo_label: string;
  severidade: number;
  status: "aberto" | "em_atendimento" | "encerrado";
  clinica_id: string | null;
  escalonado_para: string | null;
  criado_em: string;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function corSeveridade(sev: number): "ok" | "ambar" | "humano" | "alerta" {
  if (sev >= 5) return "alerta";
  if (sev >= 4) return "humano";
  if (sev >= 3) return "ambar";
  return "ok";
}

export function TabelaEventos({ eventos }: { eventos: EventoLinha[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [emAcao, setEmAcao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function encerrar(id: string) {
    if (!confirm("Encerrar este evento? A ação é auditável.")) return;
    setEmAcao(id);
    setErro(null);
    try {
      const r = await fetch(`/api/risco-grave/${id}/encerrar`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErro(j.erro ?? `Falha (${r.status})`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErro("Falha de rede ao encerrar evento");
    } finally {
      setEmAcao(null);
    }
  }

  return (
    <div className="space-y-3">
      {erro && (
        <div className="rounded-lg border border-alerta/30 bg-alerta/[0.06] px-3 py-2 text-xs text-alerta">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line/10 text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Severidade</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Marcador</th>
              <th className="py-2 pr-3">Escalonado</th>
              <th className="py-2 pr-3">Criado</th>
              <th className="py-2 pr-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => {
              const aguardando = (pending && emAcao === e.id) || emAcao === e.id;
              return (
                <tr
                  key={e.id}
                  className={cn(
                    "border-b border-line/5 align-middle",
                    aguardando && "opacity-60",
                  )}
                >
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2 font-medium text-ink">
                      <AlertOctagon className="h-4 w-4 text-alerta" />
                      {e.tipo_label}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge tone={corSeveridade(e.severidade)}>{e.severidade}/5</Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge tone={e.status === "aberto" ? "alerta" : "ambar"}>
                      {e.status === "aberto" ? "aberto" : "em atendimento"}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3 font-mono text-[11px] text-ink-muted">
                    {e.marcador_anonimo.slice(0, 16)}
                    {e.marcador_anonimo.length > 16 && "…"}
                  </td>
                  <td className="py-3 pr-3 text-ink-muted">
                    {e.escalonado_para ?? "—"}
                  </td>
                  <td className="py-3 pr-3 text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {fmt(e.criado_em)}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <button
                      type="button"
                      onClick={() => encerrar(e.id)}
                      disabled={aguardando}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                        "bg-ok/10 text-ok ring-ok/25 hover:bg-ok/15",
                        aguardando && "cursor-not-allowed opacity-50",
                      )}
                      aria-label={`Encerrar evento ${e.tipo_label}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Encerrar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
