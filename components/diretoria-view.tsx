"use client";

import { useMemo, useState } from "react";
import { Building2, Users, Activity, Filter, Percent } from "lucide-react";
import { Card, Badge, ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { EmpresaResumo, NivelRisco } from "@/lib/diretoria";

const NIVEL: Record<NivelRisco, { label: string; tone: "ok" | "ambar" | "humano" | "alerta"; bar: "ok" | "ia" | "humano" }> = {
  baixo: { label: "Baixo", tone: "ok", bar: "ok" },
  moderado: { label: "Moderado", tone: "ambar", bar: "ia" },
  alto: { label: "Alto", tone: "humano", bar: "humano" },
  critico: { label: "Crítico", tone: "alerta", bar: "humano" },
};

export function DiretoriaView({
  empresas,
  segmentos,
}: {
  empresas: EmpresaResumo[];
  segmentos: string[];
}) {
  const [seg, setSeg] = useState<string>("todos");

  const lista = useMemo(
    () =>
      (seg === "todos" ? empresas : empresas.filter((e) => e.segmento === seg))
        .slice()
        .sort((a, b) => b.risco - a.risco),
    [empresas, seg],
  );

  const stats = useMemo(() => {
    const porNivel: Record<NivelRisco, number> = { baixo: 0, moderado: 0, alto: 0, critico: 0 };
    let colab = 0;
    let resp = 0;
    let pond = 0;
    for (const e of lista) {
      porNivel[e.nivel]++;
      colab += e.colaboradores;
      resp += e.respostas;
      pond += e.risco * e.respostas;
    }
    return {
      empresas: lista.length,
      colaboradores: colab,
      respostas: resp,
      adesao: colab > 0 ? Math.min(100, Math.round((resp / colab) * 100)) : 0,
      riscoMedio: resp > 0 ? Math.round(pond / resp) : 0,
      porNivel,
    };
  }, [lista]);

  const riscoNivel = stats.riscoMedio >= 75 ? "critico" : stats.riscoMedio >= 55 ? "alto" : stats.riscoMedio >= 35 ? "moderado" : "baixo";

  return (
    <div className="space-y-6">
      {/* KPIs consolidados (respeitam o filtro de segmento) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={<Users className="h-4 w-4" />} rotulo="Colaboradores" valor={stats.colaboradores.toLocaleString("pt-BR")} hint={seg === "todos" ? "no grupo" : "no segmento"} />
        <Kpi icon={<Building2 className="h-4 w-4" />} rotulo="Empresas" valor={String(stats.empresas)} hint={seg === "todos" ? "no grupo" : seg} />
        <Kpi icon={<Percent className="h-4 w-4" />} rotulo="Adesão média" valor={`${stats.adesao}%`} hint={`${stats.respostas.toLocaleString("pt-BR")} respostas`} />
        <Kpi
          icon={<Activity className="h-4 w-4" />}
          rotulo="Risco médio"
          valor={String(stats.riscoMedio)}
          hint={NIVEL[riscoNivel].label}
          tone={NIVEL[riscoNivel].tone}
        />
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">Distribuição</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["critico", "alto", "moderado", "baixo"] as NivelRisco[]).map((n) => (
              <Badge key={n} tone={NIVEL[n].tone}>
                {stats.porNivel[n]} {NIVEL[n].label.toLowerCase()}
              </Badge>
            ))}
          </div>
        </Card>
      </div>

      {/* Filtro por segmento */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <Filter className="h-3.5 w-3.5" /> Segmento:
        </span>
        <Chip ativo={seg === "todos"} onClick={() => setSeg("todos")}>
          Todos ({empresas.length})
        </Chip>
        {segmentos.map((s) => (
          <Chip key={s} ativo={seg === s} onClick={() => setSeg(s)}>
            {s} ({empresas.filter((e) => e.segmento === s).length})
          </Chip>
        ))}
      </div>

      {/* Lista segregada por empresa */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((e) => {
          const nv = NIVEL[e.nivel];
          return (
            <Card key={e.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-base font-semibold text-ink">{e.nome}</div>
                  <div className="truncate text-xs text-ink-muted">{e.segmento}</div>
                </div>
                <Badge tone={nv.tone}>{nv.label}</Badge>
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs text-ink-muted">Índice de risco</span>
                  <span className="font-display text-lg font-semibold text-ink">{e.risco}</span>
                </div>
                <ProgressBar value={e.risco} tone={nv.bar} />
              </div>
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>{e.colaboradores.toLocaleString("pt-BR")} colaboradores</span>
                <span>{e.adesao}% adesão · {e.respostas.toLocaleString("pt-BR")} resp.</span>
              </div>
            </Card>
          );
        })}
      </div>

      {lista.length === 0 && (
        <Card className="text-center text-sm text-ink-muted">Nenhuma empresa neste segmento.</Card>
      )}
    </div>
  );
}

function Kpi({
  icon,
  rotulo,
  valor,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  rotulo: string;
  valor: string;
  hint?: string;
  tone?: "ok" | "ambar" | "humano" | "alerta";
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
        <span className="shrink-0 text-ia">{icon}</span>
        <span className="truncate">{rotulo}</span>
      </div>
      <div className="mt-2 font-display text-3xl font-semibold leading-none tabular-nums text-ink">{valor}</div>
      {hint && (
        <div className="mt-2">
          {tone ? (
            <Badge tone={tone}>{hint}</Badge>
          ) : (
            <span className="text-xs text-ink-muted">{hint}</span>
          )}
        </div>
      )}
    </Card>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        ativo
          ? "border-ia/40 bg-ia/10 text-ink shadow-glow"
          : "border-line/10 bg-fill/[0.02] text-ink-muted hover:border-line/20 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
