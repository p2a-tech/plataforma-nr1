"use client";

import { useEffect, useState } from "react";
import { ListChecks, X, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import {
  rotuloClassificacao,
  toneClassificacao,
  type Classificacao,
} from "@/lib/drps-escoragem";
import type { AcaoRecomendada } from "@/lib/plano-acao";

/**
 * Painel lateral (drawer) que abre quando o usuário clica em "Ver plano
 * sugerido" num fator. Mostra a lista de ações do programa correto e um
 * mini-formulário para criar plano (POST /api/planos-acao).
 *
 * As ações vêm hidratadas via fetch (não fazemos isso em SSR pra evitar
 * renderizar 35 listas; só busca quando o painel abre).
 */

interface Props {
  aberto: { fatorId: string; classificacao: Classificacao } | null;
  fatorNome: string;
  onFechar: () => void;
}

export function PainelPlano({ aberto, fatorNome, onFechar }: Props) {
  const [acoes, setAcoes] = useState<AcaoRecomendada[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");

  useEffect(() => {
    if (!aberto) {
      setAcoes([]);
      setEscolhida(null);
      setErro(null);
      setResponsavel("");
      setPrazo("");
      return;
    }
    setLoading(true);
    setErro(null);
    fetch(
      `/api/planos-acao/sugestao?fator_id=${encodeURIComponent(
        aberto.fatorId,
      )}&classificacao=${aberto.classificacao}`,
    )
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).erro ?? `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setAcoes(d.itens ?? []))
      .catch((e) => setErro(e instanceof Error ? e.message : "Falha ao buscar"))
      .finally(() => setLoading(false));
  }, [aberto]);

  if (!aberto) return null;

  const programa = aberto.classificacao === "alto" ? "Interventivo" : "Prevencionista";

  async function criarPlano() {
    if (!aberto || !escolhida || !responsavel) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/planos-acao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fator_id: aberto.fatorId,
          classificacao: aberto.classificacao,
          acao_id: escolhida,
          responsavel,
          prazo: prazo || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.erro ?? `HTTP ${r.status}`);
      }
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar plano");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-navy-deep/60 backdrop-blur-sm"
        onClick={onFechar}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto border-l border-line/10 bg-navy-panel p-5 shadow-2xl"
        role="dialog"
        aria-label={`Plano sugerido para ${fatorNome}`}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-muted">
              <ListChecks className="h-4 w-4" /> Programa {programa}
            </div>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink">
              {fatorNome}
            </h2>
            <Badge tone={toneClassificacao(aberto.classificacao)}>
              {rotuloClassificacao(aberto.classificacao)}
            </Badge>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md p-1.5 text-ink-muted transition hover:bg-fill/10 hover:text-ink"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {loading && (
          <p className="py-8 text-center text-sm text-ink-muted">Carregando…</p>
        )}
        {erro && (
          <p className="rounded-lg border border-alerta/30 bg-alerta/10 p-3 text-sm text-alerta">
            {erro}
          </p>
        )}

        {!loading && !erro && acoes.length === 0 && (
          <p className="rounded-lg border border-dashed border-line/15 p-4 text-center text-sm text-ink-muted">
            Nenhuma ação no catálogo bate com esse fator. Crie um plano
            customizado direto no PGR.
          </p>
        )}

        {!loading && acoes.length > 0 && (
          <div className="space-y-2">
            {acoes.map((a) => (
              <label
                key={a.id}
                className={`block cursor-pointer rounded-lg border p-3 transition ${
                  escolhida === a.id
                    ? "border-ia/40 bg-ia/10"
                    : "border-line/10 bg-fill/[0.02] hover:bg-fill/[0.05]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="acao"
                    value={a.id}
                    checked={escolhida === a.id}
                    onChange={() => setEscolhida(a.id)}
                    className="mt-1 accent-ia"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink">{a.titulo}</div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {a.como_realizar}
                    </p>
                    {a.responsavel_padrao && (
                      <div className="mt-1.5 text-[11px] text-ink-muted">
                        Responsável sugerido: <strong>{a.responsavel_padrao}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Form mínimo p/ confirmar */}
        {escolhida && (
          <div className="mt-4 space-y-3 rounded-lg border border-line/10 bg-fill/[0.02] p-3">
            <label className="block text-xs font-medium text-ink-muted">
              Responsável (pessoa ou setor)
              <input
                type="text"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Ex.: Coordenação Técnica"
                className="mt-1 block w-full rounded-md border border-line/15 bg-navy-deep px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-ia/40 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              <span className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" /> Prazo (opcional)
              </span>
              <input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="mt-1 block w-full rounded-md border border-line/15 bg-navy-deep px-3 py-2 text-sm text-ink focus:border-ia/40 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={criarPlano}
              disabled={!responsavel || salvando}
              className="w-full rounded-lg bg-ia/15 px-3 py-2 text-sm font-medium text-ia ring-1 ring-inset ring-ia/30 transition hover:bg-ia/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Criar plano"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
