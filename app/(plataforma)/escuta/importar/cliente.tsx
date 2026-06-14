"use client";

import { useMemo, useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCw,
} from "lucide-react";
import { Card, CardTitle, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Componente cliente do importador DRPS.
 *
 * Fluxo:
 *   1) Usuário seleciona instrumento (default: okebambo_v1) + campanha (opt).
 *   2) Upload do CSV (FileReader local — não vai pro servidor ainda).
 *   3) Parser local mostra preview das 5 primeiras linhas + cabeçalho.
 *   4) Usuário ajusta o mapeamento por dropdown (sugestão automática).
 *   5) Pré-visualizar → POST /api/drps/importar com dry_run=true.
 *   6) Importar → POST com dry_run=false. Mostra resumo + lista de erros.
 *
 * O mapeamento é sugerido server-side via POST específico? Não — mantemos
 * tudo no cliente exceto o registro real, evitando round-trip extra. A
 * sugestão usa as mesmas substrings da função `sugerirMapeamento` do server
 * (espelhadas aqui de propósito — DRY versus simplicidade). O usuário pode
 * corrigir manualmente; o servidor revalida tudo no /api/drps/importar.
 */

type InstrumentoSel = { id: string; codigo: string; titulo: string };
type CampanhaSel = { id: string; codigo: string; titulo: string; ciclo: string };

interface Props {
  instrumentos: InstrumentoSel[];
  campanhas: CampanhaSel[];
  instrumentoPadraoId: string | null;
}

const PERGUNTAS_OKEBAMBO: Array<{ codigo: string; rotulo: string }> = [
  { codigo: "Q1", rotulo: "Q1 · Setor (demografia)" },
  { codigo: "Q2", rotulo: "Q2 · Função/cargo" },
  { codigo: "Q3", rotulo: "Q3 · Tempo de empresa" },
  { codigo: "Q4", rotulo: "Q4 · Forma de atuação" },
  { codigo: "Q5", rotulo: "Q5 · Quantidade de atendimentos (Likert 1-5)" },
  { codigo: "Q6", rotulo: "Q6 · Intervalos suficientes (Likert 1-5)" },
  { codigo: "Q7", rotulo: "Q7 · Registros sem pressa (Likert 1-5)" },
  { codigo: "Q8", rotulo: "Q8 · Condições do ambiente (Likert 1-5)" },
  { codigo: "Q9", rotulo: "Q9 · Privacidade (Likert 1-5)" },
  { codigo: "Q10", rotulo: "Q10 · Ambiente acolhedor (Likert 1-5)" },
  { codigo: "Q11", rotulo: "Q11 · Situações emocionais (Likert 1-3)" },
  { codigo: "Q12", rotulo: "Q12 · Cansaço emocional (Likert 1-3)" },
  { codigo: "Q13", rotulo: "Q13 · Suporte casos difíceis (Likert 1-5)" },
  { codigo: "Q14", rotulo: "Q14 · Apoio da equipe (Likert 1-5)" },
  { codigo: "Q15", rotulo: "Q15 · Comunicação clara (Likert 1-5)" },
  { codigo: "Q16", rotulo: "Q16 · Conforto para falar (Likert 1-5)" },
  { codigo: "Q17", rotulo: "Q17 · Impactou saúde mental (1-4)" },
  { codigo: "Q18", rotulo: "Q18 · Esgotamento (1-5)" },
  { codigo: "Q19", rotulo: "Q19 · Maior gerador de estresse (multi)" },
  { codigo: "Q20", rotulo: "Q20 · Sugestões de melhoria (multi)" },
  { codigo: "Q21", rotulo: "Q21 · Comentário livre" },
];

/* -------------------------------------------------------------------------- */
/*  Mini-parser local (espelha lib/drps-importador.parseCsv pra preview)       */
/* -------------------------------------------------------------------------- */

function parseLocal(texto: string): { headers: string[]; linhas: Record<string, string>[] } {
  if (!texto) return { headers: [], linhas: [] };
  const limpo = texto.replace(/^﻿/, "");
  const out: string[][] = [];
  let campo = "";
  let cur: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++; }
        else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { aspas = true; continue; }
    if (c === ",") { cur.push(campo); campo = ""; continue; }
    if (c === "\r") { if (limpo[i + 1] === "\n") i++; cur.push(campo); out.push(cur); campo = ""; cur = []; continue; }
    if (c === "\n") { cur.push(campo); out.push(cur); campo = ""; cur = []; continue; }
    campo += c;
  }
  if (campo.length || cur.length) { cur.push(campo); out.push(cur); }
  if (!out.length) return { headers: [], linhas: [] };
  const headers = out[0].map((h) => h.trim());
  const linhas: Record<string, string>[] = [];
  for (let r = 1; r < out.length; r++) {
    const cells = out[r];
    if (cells.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = (cells[c] ?? "").trim();
    linhas.push(obj);
  }
  return { headers, linhas };
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

const HEADERS_IGNORAR_LOCAL = [
  "carimbo de data/hora", "timestamp", "pontuacao", "score",
  "endereco de e-mail", "endereco de email", "email", "e-mail",
];

const REGRAS_LOCAIS: Array<{ codigo: string; subs: string[] }> = [
  { codigo: "Q1", subs: ["em qual setor", "setor"] },
  { codigo: "Q2", subs: ["funcao", "cargo"] },
  { codigo: "Q3", subs: ["quanto tempo", "tempo de empresa"] },
  { codigo: "Q4", subs: ["forma de atuacao", "vinculo"] },
  { codigo: "Q5", subs: ["quantidade de atendimentos", "adequada para o seu tempo"] },
  { codigo: "Q6", subs: ["intervalos suficientes"] },
  { codigo: "Q7", subs: ["registros", "relatorios", "planejamentos"] },
  { codigo: "Q8", subs: ["condicoes do ambiente", "ambiente da clinica oferece"] },
  { codigo: "Q9", subs: ["privacidade", "tranquilidade nos atendimentos"] },
  { codigo: "Q10", subs: ["acolhedor", "respeitoso entre profissionais"] },
  { codigo: "Q13", subs: ["suporte", "discutir casos", "casos dificeis"] },
  { codigo: "Q14", subs: ["apoio da equipe"] },
  { codigo: "Q15", subs: ["comunicacao clara", "comunicacao entre profissionais"] },
  { codigo: "Q16", subs: ["confortavel para falar", "falar sobre dificuldades"] },
  { codigo: "Q11", subs: ["situacoes emocionalmente", "emocionalmente dificeis"] },
  { codigo: "Q12", subs: ["cansaco emocional"] },
  { codigo: "Q17", subs: ["impactado sua saude", "impactou", "saude emocional", "saude mental"] },
  { codigo: "Q18", subs: ["esgotado", "esgotamento"] },
  { codigo: "Q19", subs: ["estresse ou dificuldade", "maior gerador de estresse"] },
  { codigo: "Q20", subs: ["poderia melhorar", "sugestoes de melhoria"] },
  { codigo: "Q21", subs: ["gostaria de acrescentar", "comentarios", "observacoes livres"] },
];

function sugerirLocal(headers: string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const usados = new Set<string>();
  for (const h of headers) {
    const n = norm(h);
    if (HEADERS_IGNORAR_LOCAL.some((x) => n.includes(norm(x)))) { out[h] = null; continue; }
    let cod: string | null = null;
    for (const r of REGRAS_LOCAIS) {
      if (usados.has(r.codigo)) continue;
      if (r.subs.some((s) => n.includes(norm(s)))) { cod = r.codigo; break; }
    }
    if (cod) usados.add(cod);
    out[h] = cod;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Componente                                                                 */
/* -------------------------------------------------------------------------- */

interface ResumoApi {
  total_lidas: number;
  sucesso: number;
  erros: Array<{ linha: number; motivos: string[] }>;
  erros_totais: number;
  dry_run: boolean;
}

export function ImportadorCliente({
  instrumentos,
  campanhas,
  instrumentoPadraoId,
}: Props) {
  const [instrumentoId, setInstrumentoId] = useState<string>(
    instrumentoPadraoId ?? instrumentos[0]?.id ?? "",
  );
  const [campanhaId, setCampanhaId] = useState<string>("");
  const [csvTexto, setCsvTexto] = useState<string>("");
  const [arquivoNome, setArquivoNome] = useState<string>("");
  const [mapeamento, setMapeamento] = useState<Record<string, string | null>>({});
  const [estado, setEstado] = useState<"idle" | "loading" | "preview-ok" | "erro">("idle");
  const [resumo, setResumo] = useState<ResumoApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [expandirErros, setExpandirErros] = useState(false);

  const parsed = useMemo(() => parseLocal(csvTexto), [csvTexto]);

  function onArquivo(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setArquivoNome(f.name);
    setResumo(null);
    setErro(null);
    setEstado("idle");
    const reader = new FileReader();
    reader.onload = () => {
      const txt = String(reader.result ?? "");
      setCsvTexto(txt);
      const { headers } = parseLocal(txt);
      setMapeamento(sugerirLocal(headers));
    };
    reader.onerror = () => {
      setErro("Não foi possível ler o arquivo.");
      setEstado("erro");
    };
    reader.readAsText(f, "utf-8");
  }

  function resetar() {
    setCsvTexto("");
    setArquivoNome("");
    setMapeamento({});
    setResumo(null);
    setErro(null);
    setEstado("idle");
  }

  async function enviar(dryRun: boolean) {
    if (!instrumentoId) { setErro("Selecione um instrumento."); return; }
    if (!csvTexto) { setErro("Envie um arquivo CSV."); return; }
    setErro(null);
    setEstado("loading");
    try {
      const r = await fetch("/api/drps/importar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          csv_texto: csvTexto,
          mapeamento,
          instrumento_id: instrumentoId,
          campanha_id: campanhaId || null,
          dry_run: dryRun,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data?.erro ?? "Falha ao processar.");
        setEstado("erro");
        return;
      }
      setResumo(data.resumo as ResumoApi);
      setEstado("preview-ok");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de rede.");
      setEstado("erro");
    }
  }

  const headers = parsed.headers;
  const preview = parsed.linhas.slice(0, 5);
  const temCsv = headers.length > 0;
  const codigosMapeados = Object.values(mapeamento).filter((v) => v !== null) as string[];

  return (
    <div className="space-y-6">
      {/* 1) Seletores */}
      <Card>
        <CardTitle
          icon={<FileText className="h-5 w-5" />}
          hint="Escolha o instrumento DRPS de destino e, opcionalmente, a campanha."
        >
          1. Destino da importação
        </CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Instrumento</span>
            <select
              value={instrumentoId}
              onChange={(e) => setInstrumentoId(e.target.value)}
              className="mt-1 w-full rounded-md border border-line/10 bg-fill/5 px-3 py-2 text-sm text-ink focus:border-ia/40 focus:outline-none"
            >
              {instrumentos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.titulo} ({i.codigo})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Campanha (opcional)</span>
            <select
              value={campanhaId}
              onChange={(e) => setCampanhaId(e.target.value)}
              className="mt-1 w-full rounded-md border border-line/10 bg-fill/5 px-3 py-2 text-sm text-ink focus:border-ia/40 focus:outline-none"
            >
              <option value="">— Sem campanha (avulsa) —</option>
              {campanhas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo} · {c.ciclo}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {/* 2) Upload */}
      <Card>
        <CardTitle
          icon={<Upload className="h-5 w-5" />}
          hint="CSV exportado do Google Forms. Máx 10MB."
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
          2. Arquivo CSV
        </CardTitle>

        {!temCsv ? (
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-line/15 bg-fill/5 p-8 text-center transition hover:border-ia/40 hover:bg-ia/5">
            <Upload className="mx-auto h-8 w-8 text-ink-muted" />
            <p className="mt-3 text-sm font-medium text-ink">
              Arraste o CSV aqui ou clique para selecionar
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Aceita .csv com cabeçalho do Google Forms.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onArquivo}
              className="hidden"
            />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-line/10 bg-fill/5 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-ink">
                <FileText className="h-4 w-4 text-ia" />
                <code className="text-xs">{arquivoNome}</code>
              </span>
              <Badge tone="ia">
                {parsed.linhas.length} linha{parsed.linhas.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>
        )}
      </Card>

      {/* 3) Mapeamento + Preview */}
      {temCsv && (
        <Card>
          <CardTitle
            hint="Sugestão automática por substring. Revise antes de pré-visualizar."
            action={
              <Badge tone={codigosMapeados.length >= 18 ? "ok" : "ambar"}>
                {codigosMapeados.length}/{PERGUNTAS_OKEBAMBO.length} mapeadas
              </Badge>
            }
          >
            3. Mapeamento de colunas
          </CardTitle>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-2 pr-3">Coluna do CSV</th>
                  <th className="py-2 pr-3">→ Pergunta DRPS</th>
                  <th className="py-2 pr-3">Amostra (1ª linha)</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h) => (
                  <tr key={h} className="border-t border-line/5 align-top">
                    <td className="py-2 pr-3 text-ink/85">
                      <code className="text-[11px]">{h}</code>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={mapeamento[h] ?? ""}
                        onChange={(e) =>
                          setMapeamento((m) => ({
                            ...m,
                            [h]: e.target.value || null,
                          }))
                        }
                        className="rounded-md border border-line/10 bg-fill/5 px-2 py-1 text-xs text-ink focus:border-ia/40 focus:outline-none"
                      >
                        <option value="">— Ignorar —</option>
                        {PERGUNTAS_OKEBAMBO.map((p) => (
                          <option key={p.codigo} value={p.codigo}>
                            {p.rotulo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3 text-ink-muted">
                      {(preview[0]?.[h] ?? "").slice(0, 60) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.length > 0 && (
            <details className="mt-4 rounded-md border border-line/10 bg-fill/5">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-muted">
                Pré-visualização (primeiras {preview.length} linhas)
              </summary>
              <div className="max-h-64 overflow-auto px-3 py-2">
                <table className="w-full text-left text-[11px]">
                  <thead className="text-[10px] uppercase text-ink-muted">
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="py-1 pr-3">
                          {h.slice(0, 24)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-line/5">
                        {headers.map((h) => (
                          <td key={h} className="py-1 pr-3 text-ink/85">
                            {(row[h] ?? "").slice(0, 40)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </Card>
      )}

      {/* 4) Ações */}
      {temCsv && (
        <Card>
          <CardTitle hint="Pré-visualize antes de gravar — dry-run não toca no banco.">
            4. Pré-visualizar e importar
          </CardTitle>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={estado === "loading"}
              onClick={() => enviar(true)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-ia/15 px-4 py-2 text-sm font-medium text-ia ring-1 ring-inset ring-ia/25 transition hover:bg-ia/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {estado === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Pré-visualizar (dry-run)
            </button>
            <button
              type="button"
              disabled={estado === "loading" || !resumo?.dry_run || resumo.sucesso === 0}
              onClick={() => enviar(false)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-humano/15 px-4 py-2 text-sm font-medium text-humano ring-1 ring-inset ring-humano/25 transition hover:bg-humano/25 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                !resumo?.dry_run
                  ? "Faça uma pré-visualização primeiro"
                  : resumo.sucesso === 0
                  ? "Nenhuma linha válida pra importar"
                  : "Grava de fato (idempotente)"
              }
            >
              {estado === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Importar agora
            </button>
            {resumo && !resumo.dry_run && resumo.sucesso > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ok">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Gravado com sucesso.
              </span>
            )}
          </div>

          {/* Feedback */}
          {erro && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-alerta/20 bg-alerta/10 p-3 text-sm text-alerta">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>{erro}</div>
            </div>
          )}

          {resumo && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Kpi label="Lidas" v={resumo.total_lidas} />
                <Kpi label={resumo.dry_run ? "Válidas (dry-run)" : "Gravadas"} v={resumo.sucesso} tone="ok" />
                <Kpi label="Com erro" v={resumo.erros_totais} tone={resumo.erros_totais ? "alerta" : "neutro"} />
              </div>

              {resumo.erros.length > 0 && (
                <details
                  open={expandirErros}
                  onToggle={(e) => setExpandirErros((e.target as HTMLDetailsElement).open)}
                  className="rounded-md border border-alerta/20 bg-alerta/5"
                >
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-alerta">
                    Detalhes dos erros ({resumo.erros.length}{resumo.erros_totais > resumo.erros.length ? ` de ${resumo.erros_totais}` : ""})
                  </summary>
                  <ul className="max-h-64 space-y-1 overflow-auto px-4 py-2 text-[11px] text-ink/85">
                    {resumo.erros.map((er, i) => (
                      <li key={i} className="border-t border-line/5 pt-1 first:border-0 first:pt-0">
                        <strong className="text-ink">Linha {er.linha}:</strong>{" "}
                        {er.motivos.join("; ")}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
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
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className={cn("mt-1 font-display text-2xl font-semibold", toneCls)}>
        {v}
      </div>
    </div>
  );
}
