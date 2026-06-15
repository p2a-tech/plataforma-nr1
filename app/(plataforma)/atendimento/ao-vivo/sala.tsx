"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteParticipant,
  type LocalTrackPublication,
  createLocalTracks,
} from "livekit-client";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Link2,
  Check,
  Loader2,
  Lock,
  Bot,
  Sparkles,
  EyeOff,
  AlertTriangle,
  Activity,
  Radio,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  OFENSORES_LABEL,
  TURNOS,
  type OfensorTag,
  type Severidade,
} from "@previa/contracts";

const CLINICA_ID = "clin_translog_demo";

/* ── tipos da análise (mesmo formato de /atendimento) ─────────────────────── */
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

/* ── tipagem mínima do Web Speech API (não está no lib.dom padrão) ─────────── */
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Estado = "ocioso" | "conectando" | "conectado" | "encerrado";

export function SalaAoVivo() {
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [sala, setSala] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remotoPresente, setRemotoPresente] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // transcrição ao vivo (fica no browser; só o agregado cruza a barreira)
  const [transcricao, setTranscricao] = useState("");
  const [parcial, setParcial] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const [srSuportado, setSrSuportado] = useState(true);

  // análise (ao encerrar)
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [analisando, setAnalisando] = useState(false);

  // devolutiva ao sistêmico
  const [setor, setSetor] = useState("Logística");
  const [turno, setTurno] = useState<(typeof TURNOS)[number]>("noite");
  const [site, setSite] = useState("SP-03");
  const [enviando, setEnviando] = useState(false);
  const [encerramento, setEncerramento] = useState<any>(null);
  const [iniciadaEm, setIniciadaEm] = useState<number | null>(null);

  const roomRef = useRef<Room | null>(null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const palavras = transcricao.trim() ? transcricao.trim().split(/\s+/).length : 0;

  useEffect(() => {
    setSrSuportado(Boolean(getSpeechRecognitionCtor()));
  }, []);

  /* ── transcrição local (Web Speech API) ─────────────────────────────────── */
  const iniciarTranscricao = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSrSuportado(false);
      return;
    }
    if (recogRef.current) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalTxt = "";
      let interimTxt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalTxt += t + " ";
        else interimTxt += t;
      }
      if (finalTxt) setTranscricao((prev) => (prev + finalTxt).replace(/\s{2,}/g, " "));
      setParcial(interimTxt);
    };
    rec.onerror = (ev) => {
      // 'no-speech'/'aborted' são normais; não tratamos como erro fatal.
      if (ev.error !== "no-speech" && ev.error !== "aborted") {
        console.warn("[teleconsulta] SpeechRecognition erro:", ev.error);
      }
    };
    rec.onend = () => {
      // Reinicia enquanto a sessão estiver ouvindo (continuous expira em alguns navegadores).
      if (recogRef.current && roomRef.current) {
        try {
          rec.start();
        } catch {
          /* já reiniciando */
        }
      }
    };
    recogRef.current = rec;
    try {
      rec.start();
      setOuvindo(true);
    } catch {
      /* já iniciado */
    }
  }, []);

  const pararTranscricao = useCallback(() => {
    const rec = recogRef.current;
    recogRef.current = null;
    setOuvindo(false);
    setParcial("");
    if (rec) {
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    }
  }, []);

  /* ── conexão LiveKit ─────────────────────────────────────────────────────── */
  const conectar = useCallback(async () => {
    setErro(null);
    setEstado("conectando");
    setEncerramento(null);
    setAnalise(null);
    try {
      const r = await fetch("/api/atendimento/ao-vivo/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (r.status === 503) {
        setErro("Teleconsulta não configurada no servidor (LIVEKIT_*).");
        setEstado("ocioso");
        return;
      }
      if (!r.ok) {
        setErro("Não foi possível obter o acesso à sala.");
        setEstado("ocioso");
        return;
      }
      const { url, token, sala: salaNome } = (await r.json()) as {
        url: string;
        token: string;
        sala: string;
      };

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
            track.attach(remoteVideoRef.current);
            setRemotoPresente(true);
          } else if (track.kind === Track.Kind.Audio) {
            track.attach(); // elemento de áudio anexado ao DOM automaticamente
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach();
        })
        .on(RoomEvent.ParticipantConnected, (_p: RemoteParticipant) => {
          setRemotoPresente(true);
        })
        .on(RoomEvent.ParticipantDisconnected, () => {
          setRemotoPresente(room.numParticipants > 1);
        })
        .on(RoomEvent.Disconnected, () => {
          setRemotoPresente(false);
        });

      await room.connect(url, token);

      // Publica câmera + microfone locais.
      const tracks = await createLocalTracks({ audio: true, video: true });
      for (const t of tracks) {
        await room.localParticipant.publishTrack(t);
        if (t.kind === Track.Kind.Video && localVideoRef.current) {
          t.attach(localVideoRef.current);
        }
      }

      setSala(salaNome);
      setIniciadaEm(Date.now());
      setEstado("conectado");
      setMicOn(true);
      setCamOn(true);
      // Liga a transcrição ao vivo automaticamente (no browser).
      iniciarTranscricao();
    } catch (e) {
      console.error("[teleconsulta] falha ao conectar", e);
      setErro("Falha ao conectar. Verifique câmera/microfone e tente de novo.");
      setEstado("ocioso");
      roomRef.current?.disconnect();
      roomRef.current = null;
    }
  }, [iniciarTranscricao]);

  const alternarMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const novo = !micOn;
    await room.localParticipant.setMicrophoneEnabled(novo);
    setMicOn(novo);
  }, [micOn]);

  const alternarCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const novo = !camOn;
    await room.localParticipant.setCameraEnabled(novo);
    setCamOn(novo);
    // re-attach o vídeo local após reativar
    if (novo && localVideoRef.current) {
      const pub = room.localParticipant
        .getTrackPublications()
        .find((p) => p.kind === Track.Kind.Video) as LocalTrackPublication | undefined;
      pub?.videoTrack?.attach(localVideoRef.current);
    }
  }, [camOn]);

  /* ── encerrar: para tudo, manda transcript pro analisador existente ──────── */
  const encerrar = useCallback(async () => {
    pararTranscricao();
    const room = roomRef.current;
    roomRef.current = null;
    room?.disconnect();
    setEstado("encerrado");
    setRemotoPresente(false);

    const texto = transcricao.trim();
    if (!texto) {
      setAnalise(null);
      return;
    }
    setAnalisando(true);
    try {
      const r = await fetch("/api/atendimento/analisar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcricao: texto }),
      });
      if (r.ok) setAnalise(await r.json());
    } catch {
      /* mantém UI sem análise */
    } finally {
      setAnalisando(false);
    }
  }, [pararTranscricao, transcricao]);

  /* ── devolutiva ao sistêmico (anônima) — reusa /encerrar ─────────────────── */
  const enviarSistemico = useCallback(async () => {
    if (!analise) return;
    setEnviando(true);
    const duracaoMin = iniciadaEm
      ? Math.max(1, Math.min(240, Math.round((Date.now() - iniciadaEm) / 60_000)))
      : 1;
    try {
      const res = await fetch("/api/atendimento/encerrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clinica_id: CLINICA_ID,
          iniciada_em: new Date(iniciadaEm ?? Date.now() - duracaoMin * 60_000).toISOString(),
          duracao_minutos: duracaoMin,
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
  }, [analise, iniciadaEm, setor, turno, site]);

  const copiarLinkPaciente = useCallback(async () => {
    if (!sala) return;
    const url = `${window.location.origin}/tc/${sala}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard pode falhar em http; ignora */
    }
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  }, [sala]);

  /* ── cleanup ao desmontar ────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      recogRef.current?.stop?.();
      recogRef.current = null;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  const emChamada = estado === "conectado";

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Teleconsulta ao vivo"
        descricao="Videochamada com o trabalhador. A transcrição roda no seu navegador e é descartada — só o agregado anônimo cruza a barreira ao encerrar."
        badge={
          <Badge tone="humano">
            <Lock className="h-3 w-3" /> Sigilo clínico
          </Badge>
        }
      />

      {erro && (
        <div className="flex items-start gap-3 rounded-2xl border border-alerta/40 bg-alerta/10 p-4 text-sm text-alerta">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          {erro}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* ── VÍDEO ──────────────────────────────────────────────────────── */}
        <Card className="flex flex-col">
          <CardTitle
            icon={<Video className="h-5 w-5 text-humano" />}
            hint="WebRTC ponta a ponta (LiveKit). O vídeo não é gravado."
            action={
              emChamada ? (
                <Badge tone="ok">
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
                  Ao vivo
                </Badge>
              ) : estado === "encerrado" ? (
                <Badge tone="neutro">Encerrada</Badge>
              ) : (
                <Badge tone="neutro">Pronto</Badge>
              )
            }
          >
            Sala de vídeo
          </CardTitle>

          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-line/10 bg-navy-deep/60">
            {/* vídeo remoto (trabalhador) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={cn(
                "h-full w-full object-cover",
                remotoPresente ? "opacity-100" : "opacity-0",
              )}
            />
            {!remotoPresente && (
              <div className="absolute inset-0 grid place-items-center text-center text-sm text-ink-muted">
                <div>
                  <Radio className="mx-auto mb-2 h-7 w-7 opacity-40" />
                  {emChamada
                    ? "Aguardando o trabalhador entrar pelo link…"
                    : "Inicie a teleconsulta para abrir a sala."}
                </div>
              </div>
            )}

            {/* vídeo local (psicólogo) — PiP */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "absolute bottom-3 right-3 h-24 w-32 rounded-xl border border-humano/30 object-cover shadow-lg sm:h-28 sm:w-40",
                emChamada && camOn ? "opacity-100" : "opacity-0",
              )}
            />
          </div>

          {/* controles */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!emChamada && estado !== "encerrado" && (
              <button
                onClick={conectar}
                disabled={estado === "conectando"}
                className="flex items-center gap-2 rounded-xl bg-humano px-4 py-2.5 text-sm font-semibold text-onaccent transition hover:bg-humano/90 disabled:opacity-50"
              >
                {estado === "conectando" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Video className="h-4 w-4" />
                )}
                Iniciar teleconsulta
              </button>
            )}

            {emChamada && (
              <>
                <button
                  onClick={alternarMic}
                  aria-pressed={micOn}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium ring-1 ring-inset transition",
                    micOn
                      ? "bg-fill/5 text-ink ring-line/10 hover:bg-fill/10"
                      : "bg-alerta/15 text-alerta ring-alerta/25",
                  )}
                >
                  {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  {micOn ? "Microfone" : "Mudo"}
                </button>
                <button
                  onClick={alternarCam}
                  aria-pressed={camOn}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium ring-1 ring-inset transition",
                    camOn
                      ? "bg-fill/5 text-ink ring-line/10 hover:bg-fill/10"
                      : "bg-alerta/15 text-alerta ring-alerta/25",
                  )}
                >
                  {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  {camOn ? "Câmera" : "Sem vídeo"}
                </button>
                <button
                  onClick={copiarLinkPaciente}
                  className="flex items-center gap-2 rounded-xl bg-ia/15 px-3.5 py-2.5 text-sm font-medium text-ia ring-1 ring-inset ring-ia/25 transition hover:bg-ia/20"
                >
                  {linkCopiado ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {linkCopiado ? "Link copiado" : "Copiar link do paciente"}
                </button>
                <button
                  onClick={encerrar}
                  className="ml-auto flex items-center gap-2 rounded-xl bg-alerta px-4 py-2.5 text-sm font-semibold text-onaccent transition hover:bg-alerta/90"
                >
                  <PhoneOff className="h-4 w-4" /> Encerrar
                </button>
              </>
            )}
          </div>

          {sala && (
            <p className="mt-3 break-all text-xs text-ink-muted">
              Link do paciente:{" "}
              <span className="font-mono text-ink">
                {typeof window !== "undefined" ? window.location.origin : ""}/tc/{sala}
              </span>
            </p>
          )}
        </Card>

        {/* ── TRANSCRIÇÃO AO VIVO (fica no browser) ──────────────────────── */}
        <Card className="flex flex-col">
          <CardTitle
            icon={<Lock className="h-5 w-5 text-humano" />}
            hint="Web Speech API · pt-BR. Nunca sai do navegador até virar agregado anônimo."
            action={
              ouvindo ? (
                <Badge tone="humano">
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-humano" />
                  Ouvindo
                </Badge>
              ) : (
                <Badge tone="neutro">{palavras} palavras</Badge>
              )
            }
          >
            Transcrição ao vivo
          </CardTitle>

          {!srSuportado && (
            <div className="mb-3 rounded-lg bg-humano-soft/15 px-3 py-2 text-xs text-humano-soft">
              Este navegador não suporta transcrição automática. Você pode digitar/ajustar a
              transcrição abaixo manualmente antes de encerrar.
            </div>
          )}

          <textarea
            value={transcricao + (parcial ? (transcricao ? " " : "") + parcial : "")}
            onChange={(e) => {
              setTranscricao(e.target.value);
              setParcial("");
            }}
            placeholder={
              emChamada
                ? "A fala aparecerá aqui conforme a conversa…"
                : "Inicie a teleconsulta para transcrever, ou digite manualmente."
            }
            className="min-h-[280px] flex-1 resize-none rounded-xl border border-line/10 bg-navy-deep/30 p-3.5 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-muted/50 focus:border-humano/40"
          />

          <div className="mt-3 flex items-center gap-2 rounded-lg bg-humano/10 px-3 py-2 text-xs text-humano">
            <EyeOff className="h-4 w-4 shrink-0" />
            A transcrição é processada e descartada. A plataforma PrevIA nunca a armazena.
          </div>
        </Card>
      </div>

      {/* ── ANÁLISE (ao encerrar) ────────────────────────────────────────── */}
      {(analisando || analise) && (
        <Card className="flex flex-col">
          <CardTitle
            icon={<Bot className="h-5 w-5" />}
            hint="Ofensores organizacionais e métricas — o que pode atravessar a barreira"
            action={
              <Badge tone="ia">
                {analisando ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {analise?.engine === "anthropic" ? "Claude" : "IA"}
              </Badge>
            }
          >
            Interpretação da IA
          </CardTitle>

          {analisando && (
            <div className="m-auto py-10 text-center text-sm text-ink-muted">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-50" />
              Analisando a transcrição…
            </div>
          )}

          {analise && !analisando && (
            <>
              {analise.riscoGrave && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-alerta/40 bg-alerta/10 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-alerta" />
                  <div>
                    <div className="font-display text-sm font-semibold text-alerta">
                      Protocolo de risco grave/iminente
                    </div>
                    <p className="mt-0.5 text-sm text-ink/85">
                      A IA detectou possível sinal de risco à vida. Única exceção ao anonimato:
                      acione o fluxo humano de emergência. A IA não diagnostica — a decisão é humana.
                    </p>
                  </div>
                </div>
              )}

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
                  <div key={o.tag}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-ink">{OFENSORES_LABEL[o.tag]}</span>
                      <span className="font-mono text-xs text-ia">
                        {Math.round(o.confidence * 100)}%
                      </span>
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
                      <div
                        key={i}
                        className="rounded-xl border border-line/5 bg-fill/[0.02] p-3 text-sm"
                      >
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
      )}

      {/* ── DEVOLUTIVA AO SISTÊMICO (anônima) ────────────────────────────── */}
      {analise && !analisando && (
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
            <button
              onClick={enviarSistemico}
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
          {["Vídeo da chamada", "Transcrição completa", "Identidade do trabalhador", "Notas clínicas detalhadas"].map(
            (x) => (
              <li key={x} className="flex items-center gap-2">
                <EyeOff className="h-3.5 w-3.5 shrink-0 text-humano" /> {x}
              </li>
            ),
          )}
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
              Assinado (HMAC):{" "}
              <span className="break-all font-mono">{data?.assinatura?.slice(0, 32)}…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
