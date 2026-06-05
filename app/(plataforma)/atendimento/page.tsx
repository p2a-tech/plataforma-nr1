"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Lock,
  Bot,
  Sparkles,
  Send,
  AlertTriangle,
  Activity,
  EyeOff,
  ShieldCheck,
  Upload,
  ClipboardPaste,
  FileText,
  Loader2,
  Trash2,
  Wand2,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  OFENSORES_LABEL,
  TURNOS,
  type OfensorTag,
  type Severidade,
} from "@previa/contracts";
import { TRANSCRICAO_SIMULADA } from "@/lib/extraction/sample-transcript";

const CLINICA_ID = "clin_translog_demo";

interface Analise {
  ofensores: Array<{ tag: OfensorTag; confidence: number; ocorrencias: number }>;
  severidade: Severidade;
  notas: Array<{ topico: string; texto: string }>;
  riscoGrave: boolean;
  engine: "anthropic" | "heuristico";
}

const SEVERIDADE_TONE: Record<Severidade, "ok" | "ia" | "ambar" | "alerta"> = {
  baixa: "ok",
  media: "ia",
  alta: "ambar",
  critica: "alerta",
};
const SEVERIDADE_LABEL: Record<Severidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};
const TURNO_LABEL: Record<(typeof TURNOS)[number], string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  madrugada: "Madrugada",
};

/** Converte .vtt/.srt em texto corrido (remove cabeçalho, índices e timestamps). */
function limparLegenda(raw: string): string {
  return raw
    .split(/\r?\n/)
    .filter((l) => {
      const s = l.trim();
      if (!s) return false;
      if (/^WEBVTT/i.test(s)) return false;
      if (/^\d+$/.test(s)) return false; // índice de cue (SRT)
      if (s.includes("-->")) return false; // linha de timestamp
      return true;
    })
    .map((l) => l.replace(/<[^>]+>/g, "").trim()) // tira tags <v Nome> etc.
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function AtendimentoPage() {
  const [aba, setAba] = useState<"colar" | "arquivo">("colar");
  const [transcricao, setTranscricao] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [setor, setSetor] = useState("Logística");
  const [turno, setTurno] = useState<(typeof TURNOS)[number]>("noite");
  const [site, setSite] = useState("SP-03");
  const [duracao, setDuracao] = useState(35);
  const [enviando, setEnviando] = useState(false);
  const [encerramento, setEncerramento] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exemplo = useMemo(
    () => TRANSCRICAO_SIMULADA.map((f) => `${f.quem === "paciente" ? "Trabalhador" : "Psicólogo"}: ${f.texto}`).join("\n"),
    [],
  );

  const palavras = transcricao.trim() ? transcricao.trim().split(/\s+/).length : 0;

  const analisar = useCallback(async () => {
    if (!transcricao.trim()) return;
    setAnalisando(true);
    setEncerramento(null);
    try {
      const r = await fetch("/api/atendimento/analisar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcricao }),
      });
      if (r.ok) setAnalise(await r.json());
    } finally {
      setAnalisando(false);
    }
  }, [transcricao]);

  const onArquivo = async (file: File | undefined) => {
    if (!file) return;
    const raw = await file.text();
    const limpo = /\.(vtt|srt)$/i.test(file.name) ? limparLegenda(raw) : raw;
    setTranscricao(limpo);
    setNomeArquivo(file.name);
    setAnalise(null);
  };

  const limpar = () => {
    setTranscricao("");
    setNomeArquivo(null);
    setAnalise(null);
    setEncerramento(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const encerrar = async () => {
    if (!analise) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/atendimento/encerrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clinica_id: CLINICA_ID,
          iniciada_em: new Date(Date.now() - duracao * 60_000).toISOString(),
          duracao_minutos: Math.max(1, Math.min(240, duracao)),
          cluster: { setor, turno, site: site || undefined },
          severidade_estimada: analise.severidade,
          protocolo_emergencia_acionado: analise.riscoGrave,
          ofensores: analise.ofensores.map((o) => ({
            tag: o.tag,
            confidence: o.confidence,
            ocorrencias: o.ocorrencias,
          })),
        }),
      }).then((r) => r.json());
      setEncerramento(res);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Atendimento · Análise por IA"
        descricao="Anexe a transcrição do atendimento (texto ou arquivo). A IA interpreta e extrai ofensores organizacionais e métricas. O conteúdo fica na clínica; só o agregado anônimo cruza a barreira."
        badge={
          <Badge tone="humano">
            <Lock className="h-3 w-3" /> Sigilo clínico
          </Badge>
        }
      />

      {analise?.riscoGrave && (
        <div className="flex items-start gap-3 rounded-2xl border border-alerta/40 bg-alerta/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-alerta" />
          <div>
            <div className="font-display text-sm font-semibold text-alerta">
              Protocolo de risco grave/iminente
            </div>
            <p className="mt-0.5 text-sm text-ink/85">
              A IA detectou possível sinal de risco à vida na transcrição. Única exceção ao
              anonimato: acione o fluxo humano de emergência. A IA não diagnostica — a decisão é humana.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ENTRADA — transcrição (fica na clínica) */}
        <Card className="flex flex-col">
          <CardTitle
            icon={<Lock className="h-5 w-5 text-humano" />}
            hint="Permanece no perímetro da clínica — nunca cruza a barreira"
            action={
              <div className="flex rounded-lg bg-fill/5 p-0.5 text-xs">
                <button
                  onClick={() => setAba("colar")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition",
                    aba === "colar" ? "bg-humano/20 text-humano" : "text-ink-muted hover:text-ink",
                  )}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" /> Colar
                </button>
                <button
                  onClick={() => setAba("arquivo")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition",
                    aba === "arquivo" ? "bg-humano/20 text-humano" : "text-ink-muted hover:text-ink",
                  )}
                >
                  <Upload className="h-3.5 w-3.5" /> Arquivo
                </button>
              </div>
            }
          >
            Transcrição do atendimento
          </CardTitle>

          {aba === "colar" ? (
            <textarea
              value={transcricao}
              onChange={(e) => {
                setTranscricao(e.target.value);
                setNomeArquivo(null);
              }}
              placeholder="Cole aqui a transcrição da conversa (ex.: exportada do Meet, Zoom, ou digitada)…"
              className="min-h-[280px] flex-1 resize-none rounded-xl border border-line/10 bg-navy-deep/30 p-3.5 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-muted/50 focus:border-humano/40"
            />
          ) : (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onArquivo(e.dataTransfer.files?.[0]);
              }}
              className="flex min-h-[280px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line/15 bg-navy-deep/30 p-6 text-center transition hover:border-humano/40"
            >
              <FileText className="h-8 w-8 text-ink-muted" />
              {nomeArquivo ? (
                <div className="text-sm text-ink">
                  <span className="font-medium text-humano">{nomeArquivo}</span>
                  <div className="mt-1 text-xs text-ink-muted">{palavras} palavras · clique para trocar</div>
                </div>
              ) : (
                <div className="text-sm text-ink-muted">
                  Arraste um arquivo <span className="text-ink">.txt</span>,{" "}
                  <span className="text-ink">.vtt</span> ou <span className="text-ink">.srt</span>
                  <br />ou clique para selecionar
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.vtt,.srt,text/plain"
                className="hidden"
                onChange={(e) => onArquivo(e.target.files?.[0] ?? undefined)}
              />
            </label>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={analisar}
              disabled={!transcricao.trim() || analisando}
              className="flex items-center gap-2 rounded-xl bg-ia px-4 py-2.5 text-sm font-semibold text-onaccent transition hover:bg-ia/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {analisando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Analisar com IA
            </button>
            <button
              onClick={() => {
                setTranscricao(exemplo);
                setAba("colar");
                setNomeArquivo(null);
                setAnalise(null);
              }}
              className="flex items-center gap-2 rounded-xl bg-fill/5 px-3 py-2.5 text-sm text-ink-muted ring-1 ring-inset ring-line/10 transition hover:text-ink"
            >
              <Wand2 className="h-4 w-4" /> Carregar exemplo
            </button>
            {transcricao && (
              <button
                onClick={limpar}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-ink-muted transition hover:text-alerta"
              >
                <Trash2 className="h-4 w-4" /> Limpar
              </button>
            )}
            <span className="ml-auto text-xs text-ink-muted">{palavras} palavras</span>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg bg-humano/10 px-3 py-2 text-xs text-humano">
            <EyeOff className="h-4 w-4 shrink-0" />
            A transcrição é processada e descartada. A plataforma PrevIA nunca a armazena.
          </div>
        </Card>

        {/* SAÍDA — análise da IA */}
        <Card className="flex flex-col">
          <CardTitle
            icon={<Bot className="h-5 w-5" />}
            hint="Ofensores organizacionais e métricas — o que pode atravessar"
            action={
              <Badge tone="ia">
                {analisando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {analise?.engine === "anthropic" ? "Claude" : "IA"}
              </Badge>
            }
          >
            Interpretação da IA
          </CardTitle>

          {!analise && !analisando && (
            <div className="m-auto max-w-xs py-10 text-center text-sm text-ink-muted">
              <Bot className="mx-auto mb-2 h-7 w-7 opacity-40" />
              Anexe ou cole a transcrição e clique em <span className="text-ia">Analisar com IA</span>.
            </div>
          )}

          {analise && (
            <>
              <div className="mb-4 flex items-center justify-between rounded-xl border border-line/5 bg-fill/[0.02] px-3.5 py-2.5">
                <span className="text-sm text-ink-muted">Severidade organizacional estimada</span>
                <Badge tone={SEVERIDADE_TONE[analise.severidade]}>
                  {SEVERIDADE_LABEL[analise.severidade]}
                </Badge>
              </div>

              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-muted">
                Ofensores organizacionais detectados
              </div>
              <div className="space-y-2">
                {analise.ofensores.length === 0 && (
                  <p className="py-3 text-center text-sm text-ink-muted">
                    Nenhum ofensor organizacional evidente na transcrição.
                  </p>
                )}
                {analise.ofensores.map((o) => (
                  <div key={o.tag} className="animate-fade-up">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-ink">{OFENSORES_LABEL[o.tag]}</span>
                      <span className="font-mono text-xs text-ia">{Math.round(o.confidence * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill/8">
                      <div
                        className="h-full rounded-full bg-ia transition-all duration-500"
                        style={{ width: `${Math.round(o.confidence * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {analise.notas.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
                    <Activity className="h-3.5 w-3.5 text-humano" />
                    Notas sugeridas · só para o psicólogo
                  </div>
                  <div className="space-y-2">
                    {analise.notas.map((n, i) => (
                      <div key={i} className="rounded-xl border border-line/5 bg-fill/[0.02] p-3 text-sm">
                        <div className="mb-0.5 font-medium text-ink">{n.topico}</div>
                        <p className="text-ink/75">{n.texto}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* DEVOLUTIVA AO SISTÊMICO */}
      {analise && (
        <Card>
          <CardTitle
            icon={<Send className="h-5 w-5 text-humano" />}
            hint="Contexto agregado (cluster) + ofensores anônimos. Sem qualquer dado identificável."
          >
            Devolutiva ao sistêmico (anônima)
          </CardTitle>

          <div className="flex flex-wrap items-end gap-3">
            <Campo label="Setor">
              <input
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                className="w-36 rounded-lg border border-line/10 bg-fill/[0.03] px-2.5 py-2 text-sm text-ink outline-none focus:border-ia/40"
              />
            </Campo>
            <Campo label="Turno">
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value as (typeof TURNOS)[number])}
                className="rounded-lg border border-line/10 bg-fill/[0.03] px-2.5 py-2 text-sm text-ink outline-none focus:border-ia/40"
              >
                {TURNOS.map((t) => (
                  <option key={t} value={t} className="bg-navy-panel">
                    {TURNO_LABEL[t]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Site">
              <input
                value={site}
                onChange={(e) => setSite(e.target.value)}
                className="w-24 rounded-lg border border-line/10 bg-fill/[0.03] px-2.5 py-2 text-sm text-ink outline-none focus:border-ia/40"
              />
            </Campo>
            <Campo label="Duração (min)">
              <input
                type="number"
                min={1}
                max={240}
                value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value))}
                className="w-24 rounded-lg border border-line/10 bg-fill/[0.03] px-2.5 py-2 text-sm text-ink outline-none focus:border-ia/40"
              />
            </Campo>
            <button
              onClick={encerrar}
              disabled={enviando}
              className="ml-auto flex items-center gap-2 rounded-xl bg-ok px-4 py-2.5 text-sm font-semibold text-onaccent transition hover:bg-ok/90 disabled:opacity-50"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar ao sistêmico
            </button>
          </div>

          {encerramento && <ResumoEncerramento data={encerramento} />}
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function ResumoEncerramento({ data }: { data: any }) {
  const enviado = data?.enviado;
  const payload = data?.payload_enviado;
  const webhookStatus = data?.webhook_status;
  return (
    <div className="mt-5 grid gap-4 border-t border-line/5 pt-5 lg:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-humano">
          <Lock className="h-4 w-4" /> Ficou na clínica
        </div>
        <ul className="space-y-1.5 text-sm text-ink/80">
          {["Transcrição completa", "Identidade do trabalhador", "Notas clínicas detalhadas"].map((x) => (
            <li key={x} className="flex items-center gap-2">
              <EyeOff className="h-3.5 w-3.5 shrink-0 text-humano" /> {x}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-ia">
            <Bot className="h-4 w-4" /> Atravessou (anônimo)
          </span>
          <Badge tone={enviado ? "ok" : "ambar"}>
            {enviado ? "Aceito pelo PGR" : `webhook ${webhookStatus || "—"}`}
          </Badge>
        </div>
        {payload && (
          <div className="space-y-1.5 text-sm text-ink/85">
            <div>
              <span className="text-ink-muted">Cluster:</span> {payload.cluster.setor} ·{" "}
              {TURNO_LABEL[payload.cluster.turno as (typeof TURNOS)[number]]}
              {payload.cluster.site ? ` · ${payload.cluster.site}` : ""}
            </div>
            <div>
              <span className="text-ink-muted">Severidade:</span>{" "}
              {SEVERIDADE_LABEL[payload.severidade_estimada as Severidade]}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {payload.ofensores.map((o: { tag: OfensorTag; confidence: number }) => (
                <Badge key={o.tag} tone="ia">
                  {OFENSORES_LABEL[o.tag]} · {Math.round(o.confidence * 100)}%
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-ia/10 px-3 py-2 text-xs text-ia">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Assinado (HMAC): <span className="break-all font-mono">{data?.assinatura?.slice(0, 32)}…</span>
            </div>
            {enviado && (
              <p className="text-xs text-ok">
                Evento agregado registrado no PGR vivo. Já aparece no Dashboard e no Inventário de Riscos.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
