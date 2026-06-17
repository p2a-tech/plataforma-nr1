"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CalendarClock,
  User,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { StatusPlano } from "@/lib/plano-acao";

/**
 * Cartão de um plano de ação no quadro de acompanhamento (Onda 9).
 *
 * Client island porque:
 *   - troca o status (PATCH /api/planos-acao/:id/status) + router.refresh();
 *   - edita responsável e prazo inline (PATCH /api/planos-acao/:id).
 *
 * O cartão recebe os dados já calculados pela página (badge de vencimento etc.)
 * e só cuida da interação. Tudo gated sst|admin no backend.
 */

export interface PlanoCardData {
  id: string;
  titulo: string;
  fatorNome: string | null;
  responsavel: string;
  prazo: string | null; // YYYY-MM-DD
  status: StatusPlano;
  programa: string;
}

const STATUS_OPCOES: { value: StatusPlano; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

/** Dia (00:00 local) de uma data YYYY-MM-DD, sem fuso/UTC drift. */
function diaLocal(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1);
}

/** Badge de prazo: 'vencido', 'vence hoje', 'vence em Nd' ou data simples. */
function infoPrazo(
  prazo: string | null,
  status: StatusPlano,
): { texto: string; tone: "alerta" | "ambar" | "ok" | "neutro" } | null {
  if (!prazo) return null;
  // Planos fechados não destacam urgência — mostram só a data.
  if (status === "concluido" || status === "cancelado") {
    return { texto: prazo, tone: "neutro" };
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = diaLocal(prazo);
  const diffDias = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
  if (diffDias < 0) return { texto: "Vencido", tone: "alerta" };
  if (diffDias === 0) return { texto: "Vence hoje", tone: "ambar" };
  if (diffDias <= 7) return { texto: `Vence em ${diffDias}d`, tone: "ambar" };
  return { texto: prazo, tone: "neutro" };
}

export function CartaoPlano({ plano }: { plano: PlanoCardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Estado local otimista do status (volta ao anterior se falhar).
  const [status, setStatus] = useState<StatusPlano>(plano.status);

  // Edição inline de responsável + prazo.
  const [editando, setEditando] = useState(false);
  const [responsavel, setResponsavel] = useState(plano.responsavel);
  const [prazo, setPrazo] = useState(plano.prazo ?? "");

  const busy = pending || salvando;
  const prazoInfo = infoPrazo(plano.prazo, status);

  async function trocarStatus(novo: StatusPlano) {
    if (novo === status) return;
    const anterior = status;
    setStatus(novo);
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/planos-acao/${plano.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: novo }),
      });
      if (!res.ok) {
        setStatus(anterior);
        setErro("Falha ao salvar status");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setStatus(anterior);
      setErro("Sem conexão");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao() {
    setErro(null);
    setSalvando(true);
    try {
      const body: { responsavel?: string; prazo?: string | null } = {};
      if (responsavel.trim() && responsavel.trim() !== plano.responsavel) {
        body.responsavel = responsavel.trim();
      }
      const prazoNovo = prazo || null;
      if (prazoNovo !== plano.prazo) body.prazo = prazoNovo;
      if (Object.keys(body).length === 0) {
        setEditando(false);
        return;
      }
      const res = await fetch(`/api/planos-acao/${plano.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setErro("Falha ao salvar");
        return;
      }
      setEditando(false);
      startTransition(() => router.refresh());
    } catch {
      setErro("Sem conexão");
    } finally {
      setSalvando(false);
    }
  }

  function cancelarEdicao() {
    setResponsavel(plano.responsavel);
    setPrazo(plano.prazo ?? "");
    setEditando(false);
    setErro(null);
  }

  return (
    <div className="rounded-xl border border-line/10 bg-fill/[0.02] p-3.5 transition-colors hover:bg-fill/[0.04]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug text-ink">{plano.titulo}</p>
          {plano.fatorNome && (
            <p className="mt-0.5 text-xs text-ink-muted">{plano.fatorNome}</p>
          )}
        </div>
        {prazoInfo && <Badge tone={prazoInfo.tone}>{prazoInfo.texto}</Badge>}
      </div>

      {!editando ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" aria-hidden="true" /> {plano.responsavel}
          </span>
          {plano.prazo && (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> {plano.prazo}
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-ink-muted transition hover:bg-fill/10 hover:text-ink"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" /> Editar
          </button>
        </div>
      ) : (
        <div className="mt-2.5 space-y-2">
          <label className="block text-[11px] font-medium text-ink-muted">
            Responsável
            <input
              type="text"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="mt-1 block w-full rounded-md border border-line/15 bg-navy-deep px-2.5 py-1.5 text-xs text-ink focus:border-ia/40 focus:outline-none"
            />
          </label>
          <label className="block text-[11px] font-medium text-ink-muted">
            Prazo
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="mt-1 block w-full rounded-md border border-line/15 bg-navy-deep px-2.5 py-1.5 text-xs text-ink focus:border-ia/40 focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={salvarEdicao}
              disabled={busy}
              className="flex items-center gap-1 rounded-md bg-ia/15 px-2.5 py-1 text-xs font-medium text-ia ring-1 ring-inset ring-ia/30 transition hover:bg-ia/25 disabled:opacity-50"
            >
              <Check className="h-3 w-3" aria-hidden="true" /> Salvar
            </button>
            <button
              type="button"
              onClick={cancelarEdicao}
              disabled={busy}
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-ink-muted transition hover:bg-fill/10 hover:text-ink disabled:opacity-50"
            >
              <X className="h-3 w-3" aria-hidden="true" /> Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2 border-t border-line/5 pt-2.5">
        <label className="sr-only" htmlFor={`status-${plano.id}`}>
          Status do plano
        </label>
        <select
          id={`status-${plano.id}`}
          value={status}
          disabled={busy}
          onChange={(e) => trocarStatus(e.target.value as StatusPlano)}
          className={cn(
            "rounded-lg border border-line/15 bg-fill/5 px-2.5 py-1 text-xs text-ink",
            "focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20",
            busy && "opacity-60",
          )}
        >
          {STATUS_OPCOES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {busy && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" aria-hidden="true" />
        )}
        {erro && (
          <span className="text-[11px] text-alerta" role="alert">
            {erro}
          </span>
        )}
      </div>
    </div>
  );
}
