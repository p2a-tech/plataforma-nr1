"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Lock,
  AlertTriangle,
  Siren,
  Loader2,
} from "lucide-react";
import { Card, CardTitle, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                      */
/* -------------------------------------------------------------------------- */
export interface ItemGovernanca {
  id: string;
  titulo: string;
  descricao: string;
  ativo: boolean;
  critico: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Switch reutilizável (Tailwind puro) — ciano quando ON                      */
/* -------------------------------------------------------------------------- */
function Switch({
  checked,
  onChange,
  label,
  disabled,
  pendente,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  pendente?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled || pendente}
      title={disabled ? "Somente Gestor SST/Admin" : undefined}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ia/50 focus-visible:ring-offset-2 focus-visible:ring-offset-navy",
        checked ? "bg-ia" : "bg-fill/12",
        (disabled || pendente) && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      >
        {pendente && <Loader2 className="h-3 w-3 animate-spin text-navy" />}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Componente principal — estado real + persistência via PATCH                */
/* -------------------------------------------------------------------------- */
export function TogglesGovernanca({
  initial,
  podeEditar,
}: {
  initial: ItemGovernanca[];
  podeEditar: boolean;
}) {
  const [itens, setItens] = useState<ItemGovernanca[]>(initial);
  const [pendente, setPendente] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar(id: string) {
    if (!podeEditar || pendente) return;
    const atual = itens.find((i) => i.id === id);
    if (!atual) return;
    const novo = !atual.ativo;

    // Update otimista.
    setErro(null);
    setPendente(id);
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ativo: novo } : i)));

    try {
      const res = await fetch("/api/governanca", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ativo: novo }),
      });
      if (!res.ok) {
        const corpo = await res.json().catch(() => null);
        throw new Error(corpo?.erro ?? "Falha ao salvar");
      }
    } catch (e) {
      // Reverte + mensagem inline.
      setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ativo: atual.ativo } : i)));
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a alteração.");
    } finally {
      setPendente(null);
    }
  }

  const protocolo = itens.find((t) => t.id === "risco-grave");
  const lista = itens.filter((t) => t.id !== "risco-grave");
  const ativos = itens.filter((t) => t.ativo).length;

  return (
    <div className="space-y-6">
      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-alerta/40 bg-alerta/[0.06] px-4 py-3 text-sm font-medium text-alerta">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      )}

      {/* Toggles de governança */}
      <Card>
        <CardTitle
          icon={<Lock className="h-5 w-5" />}
          hint={
            podeEditar
              ? "Controles que garantem anonimato, consentimento e sigilo. Itens críticos não devem ser desativados."
              : "Visualização — somente Gestor SST/Admin pode alterar estes controles."
          }
          action={
            <Badge tone="ia">
              {ativos}/{itens.length} ativos
            </Badge>
          }
        >
          Controles de privacidade &amp; conformidade
        </CardTitle>

        <div className="grid gap-3 lg:grid-cols-2">
          {lista.map((t) => (
            <ToggleRow
              key={t.id}
              item={t}
              onToggle={() => alternar(t.id)}
              podeEditar={podeEditar}
              pendente={pendente === t.id}
            />
          ))}
        </div>
      </Card>

      {/* Protocolo de risco grave/iminente */}
      {protocolo && (
        <Card className="relative overflow-hidden border-humano/35 bg-humano/[0.04]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-humano/15 text-humano">
                <AlertTriangle className="h-5.5 w-5.5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                    {protocolo.titulo}
                  </h3>
                  <Badge tone="humano">
                    <Siren className="h-3 w-3" /> Exceção ao anonimato
                  </Badge>
                </div>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink/80">
                  Única exceção à regra de anonimato. Diante de um sinal de risco
                  grave e iminente à vida, a plataforma aciona{" "}
                  <span className="font-medium text-humano-soft">
                    imediatamente um fluxo humano de emergência
                  </span>
                  , conforme protocolo clínico — priorizando a proteção da pessoa
                  acima de tudo.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
              <Switch
                checked={protocolo.ativo}
                onChange={() => alternar(protocolo.id)}
                label={protocolo.titulo}
                disabled={!podeEditar}
                pendente={pendente === protocolo.id}
              />
              {!protocolo.ativo && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-alerta">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Protocolo desativado
                </span>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Linha de toggle                                                            */
/* -------------------------------------------------------------------------- */
function ToggleRow({
  item,
  onToggle,
  podeEditar,
  pendente,
}: {
  item: ItemGovernanca;
  onToggle: () => void;
  podeEditar: boolean;
  pendente: boolean;
}) {
  const criticoDesligado = item.critico && !item.ativo;

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-xl border bg-fill/[0.02] p-4 transition-colors",
        criticoDesligado
          ? "border-alerta/40 ring-1 ring-inset ring-alerta/20"
          : "border-line/5 hover:bg-fill/[0.04]",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {item.critico && (
            <ShieldCheck
              className={cn(
                "h-4 w-4 shrink-0",
                criticoDesligado ? "text-alerta" : "text-ia",
              )}
            />
          )}
          <span className="text-sm font-medium text-ink">{item.titulo}</span>
          {item.critico && (
            <Badge tone={criticoDesligado ? "alerta" : "ambar"}>
              <Lock className="h-3 w-3" /> Crítico
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          {item.descricao}
        </p>
        {criticoDesligado && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-alerta">
            <AlertTriangle className="h-3.5 w-3.5" />
            Desativar este controle compromete a conformidade e o anonimato.
          </p>
        )}
      </div>
      <Switch
        checked={item.ativo}
        onChange={onToggle}
        label={item.titulo}
        disabled={!podeEditar}
        pendente={pendente}
      />
    </div>
  );
}
