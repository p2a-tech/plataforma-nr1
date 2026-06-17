"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertOctagon,
  Sparkles,
  Bell,
  Check,
  CheckCheck,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Card, Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Tipos (espelham lib/notificacoes.ts — sem importar server-only)            */
/* -------------------------------------------------------------------------- */

type Tipo = "risco_grave" | "dsar" | "reset_senha" | "generico";

export interface NotificacaoView {
  id: string;
  tipo: Tipo;
  empresa_id: string | null;
  titulo: string;
  corpo: string;
  canal: string | null;
  status: string;
  criado_em: string;
  lida_em: string | null;
}

interface FiltroTipo {
  valor: "" | Tipo;
  label: string;
}

/* -------------------------------------------------------------------------- */
/*  Visual por tipo                                                            */
/* -------------------------------------------------------------------------- */

const TIPO_META: Record<
  Tipo,
  { label: string; icon: typeof Bell; tone: "alerta" | "ia" | "neutro"; wrap: string }
> = {
  risco_grave: {
    label: "Risco grave",
    icon: AlertOctagon,
    tone: "alerta",
    wrap: "bg-alerta/10 text-alerta ring-alerta/20",
  },
  dsar: {
    label: "DSAR",
    icon: Sparkles,
    tone: "ia",
    wrap: "bg-ia/10 text-ia ring-ia/20",
  },
  generico: {
    label: "Aviso",
    icon: Bell,
    tone: "neutro",
    wrap: "bg-fill/5 text-ink-muted ring-line/10",
  },
  // reset_senha não é exibido ao sst; admin pode vê-lo.
  reset_senha: {
    label: "Reset de senha",
    icon: Bell,
    tone: "neutro",
    wrap: "bg-fill/5 text-ink-muted ring-line/10",
  },
};

/** Tempo relativo curto em PT-BR a partir de um ISO. */
function tempoRelativo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const seg = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seg < 60) return "agora há pouco";
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d === 1 ? "" : "s"}`;
  const mes = Math.floor(d / 30);
  if (mes < 12) return `há ${mes} ${mes === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(mes / 12);
  return `há ${anos} ano${anos === 1 ? "" : "s"}`;
}

/* -------------------------------------------------------------------------- */
/*  Componente                                                                 */
/* -------------------------------------------------------------------------- */

export function ListaNotificacoes({
  inicial,
  naoLidasInicial,
  filtrosTipo,
}: {
  inicial: NotificacaoView[];
  naoLidasInicial: number;
  filtrosTipo: FiltroTipo[];
}) {
  const [itens, setItens] = useState<NotificacaoView[]>(inicial);
  const [naoLidas, setNaoLidas] = useState(naoLidasInicial);
  const [tipo, setTipo] = useState<"" | Tipo>("");
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [, startTransition] = useTransition();

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const qs = new URLSearchParams();
      if (tipo) qs.set("tipos", tipo);
      if (soNaoLidas) qs.set("nao_lidas", "1");
      const res = await fetch(`/api/notificacoes?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notificacoes: NotificacaoView[];
        naoLidas: number;
      };
      setItens(data.notificacoes ?? []);
      setNaoLidas(data.naoLidas ?? 0);
    } catch {
      /* silencioso — mantém o estado atual */
    } finally {
      setCarregando(false);
    }
  }, [tipo, soNaoLidas]);

  // Recarrega ao trocar filtros (pula a montagem inicial — já temos `inicial`).
  const [montou, setMontou] = useState(false);
  useEffect(() => {
    if (!montou) {
      setMontou(true);
      return;
    }
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, soNaoLidas]);

  async function marcarUma(id: string) {
    // Otimista: marca local; reverte se falhar.
    const antes = itens;
    const antesNaoLidas = naoLidas;
    const alvo = itens.find((i) => i.id === id);
    if (!alvo || alvo.lida_em) return;

    setItens((xs) =>
      xs.map((i) => (i.id === id ? { ...i, lida_em: new Date().toISOString() } : i)),
    );
    setNaoLidas((n) => Math.max(0, n - 1));

    try {
      const res = await fetch(`/api/notificacoes/${id}/lida`, { method: "PATCH" });
      if (!res.ok) {
        setItens(antes);
        setNaoLidas(antesNaoLidas);
        return;
      }
      // Se o filtro "só não lidas" está ativo, some da lista.
      if (soNaoLidas) startTransition(() => void recarregar());
    } catch {
      setItens(antes);
      setNaoLidas(antesNaoLidas);
    }
  }

  async function marcarTodas() {
    if (naoLidas === 0) return;
    setMarcandoTodas(true);
    try {
      const res = await fetch("/api/notificacoes/marcar-todas", { method: "POST" });
      if (res.ok) await recarregar();
    } finally {
      setMarcandoTodas(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de filtros + ações */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label htmlFor="filtro-tipo" className="text-xs font-medium text-ink-muted">
            Tipo
          </label>
          <select
            id="filtro-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "" | Tipo)}
            className="rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
          >
            {filtrosTipo.map((f) => (
              <option key={f.valor || "todos"} value={f.valor}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={soNaoLidas}
            onChange={(e) => setSoNaoLidas(e.target.checked)}
            className="h-3.5 w-3.5 accent-ia"
          />
          Só não lidas
        </label>

        <button
          type="button"
          onClick={() => void recarregar()}
          disabled={carregando}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm font-medium text-ink hover:bg-fill/10 disabled:opacity-60"
        >
          {carregando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Atualizar
        </button>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-ink-muted">
            {naoLidas > 0 ? (
              <>
                <span className="font-semibold text-ink">{naoLidas}</span> não lida
                {naoLidas === 1 ? "" : "s"}
              </>
            ) : (
              "tudo em dia"
            )}
          </span>
          <button
            type="button"
            onClick={marcarTodas}
            disabled={marcandoTodas || naoLidas === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ia/15 px-3 py-2 text-sm font-medium text-ia ring-1 ring-inset ring-ia/25 hover:bg-ia/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {marcandoTodas ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Marcar todas como lidas
          </button>
        </div>
      </div>

      {/* Lista */}
      {itens.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-7 w-7" />}
          titulo={soNaoLidas || tipo ? "Nenhuma notificação com os filtros atuais" : "Sem notificações ainda"}
          descricao={
            soNaoLidas || tipo
              ? "Ajuste os filtros acima para ver outras notificações."
              : "Quando houver alertas de risco grave, pedidos de DSAR ou avisos da plataforma, eles aparecem aqui."
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {itens.map((n) => {
            const meta = TIPO_META[n.tipo] ?? TIPO_META.generico;
            const Icone = meta.icon;
            const naoLida = !n.lida_em;
            return (
              <li key={n.id}>
                <Card
                  className={cn(
                    "flex items-start gap-3.5 p-4 transition-colors",
                    naoLida && "ring-1 ring-inset ring-ia/15",
                  )}
                >
                  <div
                    aria-hidden
                    className={cn(
                      "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
                      meta.wrap,
                    )}
                  >
                    <Icone className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-ink">{n.titulo}</h3>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {naoLida && <Badge tone="ia">nova</Badge>}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                      {n.corpo}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-muted/80">
                      <span>{tempoRelativo(n.criado_em)}</span>
                      {n.empresa_id && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="font-mono">{n.empresa_id}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {naoLida && (
                    <button
                      type="button"
                      onClick={() => void marcarUma(n.id)}
                      className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line/15 bg-fill/5 px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-fill/10 hover:text-ink"
                      aria-label="Marcar como lida"
                      title="Marcar como lida"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Marcar lida</span>
                    </button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
