"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import {
  rotuloClassificacao,
  toneClassificacao,
  type Classificacao,
} from "@/lib/drps-escoragem";
import {
  rotuloProbabilidade,
  rotuloImpacto,
  type Probabilidade,
  type Impacto,
} from "@/lib/matriz-risco";

/**
 * Acordeon de 5 dimensões NR-1, cada uma com lista dos fatores e seus
 * indicadores (probabilidade sugerida, impacto, classificação). Server data
 * vem como prop; client component só pra animação de open/close + drawer
 * do plano sugerido.
 */

export interface FatorRow {
  id: string;
  nome: string;
  probabilidade: Probabilidade;
  impacto: Impacto;
  classificacao: Classificacao;
  frequencia: number;
  n_citacoes: number;
  n_respostas: number;
  /** False = amostra < 7. UI oculta frequência/prob sugerida (LGPD). */
  kAnonimato: boolean;
}

export interface DimensaoBloco {
  id: string;
  nome: string;
  fatores: FatorRow[];
}

export function FatoresPorDimensao({
  dimensoes,
  onAbrirPlano,
}: {
  dimensoes: DimensaoBloco[];
  onAbrirPlano: (fatorId: string, classificacao: Classificacao) => void;
}) {
  const [aberta, setAberta] = useState<string | null>(dimensoes[0]?.id ?? null);

  if (dimensoes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line/15 bg-fill/[0.02] p-6 text-center text-sm text-ink-muted">
        Catálogo NR-1 ainda não está disponível neste banco. Aplique as
        migrations 0011-0013 do Dev A para ver os 35 fatores aqui.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dimensoes.map((d) => {
        const isOpen = aberta === d.id;
        const counts = contar(d.fatores);
        return (
          <div key={d.id} className="panel overflow-hidden p-0">
            <button
              type="button"
              onClick={() => setAberta(isOpen ? null : d.id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-fill/[0.03]"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-3">
                <ChevronDown
                  className={`h-4 w-4 text-ink-muted transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                />
                <span className="font-medium text-ink">{d.nome}</span>
                <span className="text-xs text-ink-muted">
                  {d.fatores.length} fatores
                </span>
              </div>
              <div className="flex items-center gap-2">
                {counts.alto > 0 && <Badge tone="alerta">{counts.alto} alto</Badge>}
                {counts.moderado > 0 && (
                  <Badge tone="ambar">{counts.moderado} mod.</Badge>
                )}
                {counts.baixo > 0 && <Badge tone="ok">{counts.baixo} baixo</Badge>}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-line/10 px-4 pb-4 pt-3">
                <div className="space-y-2">
                  {d.fatores.map((f) => (
                    <FatorLinha
                      key={f.id}
                      fator={f}
                      onAbrirPlano={onAbrirPlano}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function contar(fatores: FatorRow[]) {
  // Só conta classificação quando a amostra é suficiente (k≥7). Amostra
  // insuficiente não tem classificação confiável — não conta em nenhum tom.
  const validos = fatores.filter((f) => f.kAnonimato);
  return {
    baixo: validos.filter((f) => f.classificacao === "baixo").length,
    moderado: validos.filter((f) => f.classificacao === "moderado").length,
    alto: validos.filter((f) => f.classificacao === "alto").length,
  };
}

function FatorLinha({
  fator,
  onAbrirPlano,
}: {
  fator: FatorRow;
  onAbrirPlano: (fatorId: string, classificacao: Classificacao) => void;
}) {
  // K-anonimato (LGPD): se amostra < 7, mantemos o fator visível pra o gestor
  // saber que ele existe, mas ocultamos frequência e probabilidade sugerida —
  // só um badge neutro avisa que a amostra é insuficiente.
  const amostraInsuf = !fator.kAnonimato;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line/5 bg-fill/[0.02] p-3 transition hover:bg-fill/[0.04] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">{fator.nome}</span>
          {amostraInsuf ? (
            <Badge tone="neutro">Amostra insuficiente</Badge>
          ) : (
            <Badge tone={toneClassificacao(fator.classificacao)}>
              {rotuloClassificacao(fator.classificacao)}
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
          {amostraInsuf ? (
            <span title="Menos de 7 respostas no recorte — frequência omitida por k-anonimato (LGPD).">
              Frequência omitida (LGPD · k-anonimato)
            </span>
          ) : (
            <>
              <span>
                Prob.: <strong className="text-ink">{rotuloProbabilidade(fator.probabilidade)}</strong>
              </span>
              <span>
                Impacto: <strong className="text-ink">{rotuloImpacto(fator.impacto)}</strong>
              </span>
              {fator.n_respostas > 0 && (
                <span>
                  Citações DRPS: {fator.n_citacoes}/{fator.n_respostas} (
                  {(fator.frequencia * 100).toFixed(0)}%)
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAbrirPlano(fator.id, fator.classificacao)}
        className="flex items-center justify-center gap-1.5 self-start rounded-lg border border-ia/30 bg-ia/10 px-3 py-1.5 text-xs font-medium text-ia transition hover:bg-ia/20 sm:self-center"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Ver plano sugerido
      </button>
    </div>
  );
}
