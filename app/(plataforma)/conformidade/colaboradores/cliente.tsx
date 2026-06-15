"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCw,
  Users,
} from "lucide-react";
import { Card, CardTitle, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Island cliente do registro de colaboradores (S-2240 por CPF).
 *
 * Fluxo:
 *   1) Upload do CSV (FileReader local) — preview das primeiras linhas.
 *   2) POST /api/colaboradores { csv_texto } → upsert por (empresa, cpf).
 *   3) Mostra resumo {inseridos, atualizados, erros} e recarrega a tabela.
 *
 * O parsing e a validação de CPF reais acontecem no servidor; o preview local
 * é só uma cortesia visual.
 */

interface ResumoApi {
  inseridos: number;
  atualizados: number;
  erros: Array<{ linha: number; cpf?: string; motivos: string[] }>;
  erros_totais: number;
  total_lidas: number;
}

function parseLocal(texto: string): { headers: string[]; linhas: string[][] } {
  if (!texto) return { headers: [], linhas: [] };
  const limpo = texto.replace(/^﻿/, "");
  const linhas = limpo
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => l.split(/[,;]/).map((c) => c.trim()));
  if (linhas.length === 0) return { headers: [], linhas: [] };
  return { headers: linhas[0], linhas: linhas.slice(1) };
}

export function ColaboradoresUpload() {
  const router = useRouter();
  const [csvTexto, setCsvTexto] = useState("");
  const [arquivoNome, setArquivoNome] = useState("");
  const [estado, setEstado] = useState<"idle" | "loading" | "ok" | "erro">("idle");
  const [resumo, setResumo] = useState<ResumoApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const preview = useMemo(() => parseLocal(csvTexto), [csvTexto]);
  const temCsv = preview.headers.length > 0;

  function onArquivo(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setArquivoNome(f.name);
    setResumo(null);
    setErro(null);
    setEstado("idle");
    const reader = new FileReader();
    reader.onload = () => setCsvTexto(String(reader.result ?? ""));
    reader.onerror = () => {
      setErro("Não foi possível ler o arquivo.");
      setEstado("erro");
    };
    reader.readAsText(f, "utf-8");
  }

  function resetar() {
    setCsvTexto("");
    setArquivoNome("");
    setResumo(null);
    setErro(null);
    setEstado("idle");
  }

  async function importar() {
    if (!csvTexto) {
      setErro("Envie um arquivo CSV.");
      return;
    }
    setErro(null);
    setEstado("loading");
    try {
      const r = await fetch("/api/colaboradores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv_texto: csvTexto }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data?.erro ?? "Falha ao importar.");
        setEstado("erro");
        return;
      }
      setResumo(data.resumo as ResumoApi);
      setEstado("ok");
      router.refresh(); // recarrega a tabela server-side
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de rede.");
      setEstado("erro");
    }
  }

  return (
    <Card>
      <CardTitle
        icon={<Upload className="h-5 w-5" />}
        hint="CSV com cabeçalho: cpf, nome, matricula, setor, cargo, ativo. Máx 5MB."
        action={
          temCsv ? (
            <button
              type="button"
              onClick={resetar}
              className="inline-flex items-center gap-1.5 rounded-md bg-fill/10 px-2.5 py-1.5 text-xs font-medium text-ink-muted ring-1 ring-inset ring-line/10 transition hover:text-ink"
            >
              <RotateCw className="h-3.5 w-3.5" /> Trocar arquivo
            </button>
          ) : null
        }
      >
        Importar quadro de colaboradores (CSV)
      </CardTitle>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-ia/20 bg-ia/[0.06] p-3.5">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-ia" />
        <p className="text-xs leading-relaxed text-ink/75">
          Dado de RH do empregador (CPF, setor) — <strong className="text-ink">separado</strong>{" "}
          das respostas anônimas do DRPS. O CPF é usado só para gerar o eSocial S-2240 por
          trabalhador, com o perfil de risco do setor. Nenhum CPF é cruzado com respostas
          individuais.
        </p>
      </div>

      {!temCsv ? (
        <label className="block cursor-pointer rounded-xl border-2 border-dashed border-line/15 bg-fill/5 p-8 text-center transition hover:border-ia/40 hover:bg-ia/5">
          <Upload className="mx-auto h-8 w-8 text-ink-muted" />
          <p className="mt-3 text-sm font-medium text-ink">
            Arraste o CSV aqui ou clique para selecionar
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Colunas: cpf, nome, matricula, setor, cargo, ativo.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={onArquivo} className="hidden" />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-line/10 bg-fill/5 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-ink">
              <FileText className="h-4 w-4 text-ia" />
              <code className="text-xs">{arquivoNome}</code>
            </span>
            <Badge tone="ia">
              {preview.linhas.length} linha{preview.linhas.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <button
            type="button"
            disabled={estado === "loading"}
            onClick={importar}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-ia/15 px-4 py-2 text-sm font-medium text-ia ring-1 ring-inset ring-ia/25 transition hover:bg-ia/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {estado === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Importar (upsert por CPF)
          </button>
        </div>
      )}

      {erro && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-alerta/20 bg-alerta/10 p-3 text-sm text-alerta">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>{erro}</div>
        </div>
      )}

      {resumo && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Inseridos" v={resumo.inseridos} tone="ok" />
            <Kpi label="Atualizados" v={resumo.atualizados} tone="ia" />
            <Kpi
              label="Com erro"
              v={resumo.erros_totais}
              tone={resumo.erros_totais ? "alerta" : "neutro"}
            />
          </div>
          {resumo.erros.length > 0 && (
            <details className="rounded-md border border-alerta/20 bg-alerta/5">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-alerta">
                Detalhes dos erros ({resumo.erros.length}
                {resumo.erros_totais > resumo.erros.length ? ` de ${resumo.erros_totais}` : ""})
              </summary>
              <ul className="max-h-64 space-y-1 overflow-auto px-4 py-2 text-[11px] text-ink/85">
                {resumo.erros.map((er, i) => (
                  <li key={i} className="border-t border-line/5 pt-1 first:border-0 first:pt-0">
                    <strong className="text-ink">Linha {er.linha}:</strong> {er.motivos.join("; ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}

function Kpi({
  label,
  v,
  tone = "ia",
}: {
  label: string;
  v: number;
  tone?: "ia" | "ok" | "alerta" | "neutro";
}) {
  const toneCls = {
    ia: "text-ia",
    ok: "text-ok",
    alerta: "text-alerta",
    neutro: "text-ink-muted",
  }[tone];
  return (
    <div className="rounded-xl border border-line/10 bg-fill/5 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-semibold", toneCls)}>{v}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Toggle ativo/inativo por linha                                            */
/* -------------------------------------------------------------------------- */

export function ToggleAtivo({ id, ativo }: { id: string; ativo: boolean }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [valor, setValor] = useState(ativo);

  async function alternar() {
    setCarregando(true);
    try {
      const r = await fetch(`/api/colaboradores/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ativo: !valor }),
      });
      if (r.ok) {
        setValor((v) => !v);
        router.refresh();
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={carregando}
      className={cn(
        "tag inline-flex items-center gap-1 transition disabled:opacity-60",
        valor
          ? "bg-ok/15 text-ok ring-1 ring-inset ring-ok/25 hover:bg-ok/25"
          : "bg-fill/5 text-ink-muted ring-1 ring-inset ring-line/10 hover:text-ink",
      )}
      title={valor ? "Clique para inativar" : "Clique para ativar"}
    >
      {carregando ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : valor ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : null}
      {valor ? "Ativo" : "Inativo"}
    </button>
  );
}
