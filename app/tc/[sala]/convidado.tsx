"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  createLocalTracks,
} from "livekit-client";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Estado = "consentimento" | "conectando" | "conectado" | "encerrado" | "erro";

/**
 * Sala do convidado (paciente). Mobile-first. Fluxo:
 *   1. Tela de consentimento (atendimento por vídeo).
 *   2. Pede token de convidado → conecta na sala → publica áudio/vídeo.
 *   3. Mostra vídeo do psicólogo + PiP do próprio vídeo. Controles mic/cam/sair.
 */
export function SalaConvidado({
  sala,
  configurado,
}: {
  sala: string;
  configurado: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("consentimento");
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [psicologoPresente, setPsicologoPresente] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const entrar = useCallback(async () => {
    setErro(null);
    setEstado("conectando");
    try {
      const r = await fetch("/api/atendimento/ao-vivo/convidado", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sala, nome: nome.trim() || undefined }),
      });
      if (r.status === 503) {
        setErro("A teleconsulta não está disponível no momento.");
        setEstado("erro");
        return;
      }
      if (!r.ok) {
        setErro("Não foi possível entrar na sala. Confira o link com o profissional.");
        setEstado("erro");
        return;
      }
      const { url, token } = (await r.json()) as { url: string; token: string };

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
            track.attach(remoteVideoRef.current);
            setPsicologoPresente(true);
          } else if (track.kind === Track.Kind.Audio) {
            track.attach();
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => track.detach())
        .on(RoomEvent.ParticipantDisconnected, () => {
          setPsicologoPresente(room.numParticipants > 1);
        })
        .on(RoomEvent.Disconnected, () => setPsicologoPresente(false));

      await room.connect(url, token);

      const tracks = await createLocalTracks({ audio: true, video: true });
      for (const t of tracks) {
        await room.localParticipant.publishTrack(t);
        if (t.kind === Track.Kind.Video && localVideoRef.current) {
          t.attach(localVideoRef.current);
        }
      }
      setPsicologoPresente(room.numParticipants > 1);
      setEstado("conectado");
      setMicOn(true);
      setCamOn(true);
    } catch (e) {
      console.error("[tc convidado] falha ao conectar", e);
      setErro("Falha ao conectar. Permita o acesso à câmera e ao microfone e tente de novo.");
      setEstado("erro");
      roomRef.current?.disconnect();
      roomRef.current = null;
    }
  }, [sala, nome]);

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
  }, [camOn]);

  const sair = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setPsicologoPresente(false);
    setEstado("encerrado");
  }, []);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  /* ── não configurado ───────────────────────────────────────────────────── */
  if (!configurado) {
    return (
      <Shell>
        <div className="rounded-2xl border border-humano-soft/30 bg-humano-soft/10 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-humano-soft" />
          <h1 className="font-display text-lg font-semibold text-ink">
            Teleconsulta indisponível
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            A sala de atendimento por vídeo não está disponível no momento. Entre em contato com
            o profissional que lhe enviou o link.
          </p>
        </div>
      </Shell>
    );
  }

  /* ── encerrado ─────────────────────────────────────────────────────────── */
  if (estado === "encerrado") {
    return (
      <Shell>
        <div className="rounded-2xl border border-line/10 bg-fill/[0.02] p-8 text-center">
          <Heart className="mx-auto mb-3 h-8 w-8 text-humano" />
          <h1 className="font-display text-lg font-semibold text-ink">Atendimento encerrado</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            Obrigado por participar. Você já pode fechar esta janela.
          </p>
        </div>
      </Shell>
    );
  }

  /* ── consentimento ─────────────────────────────────────────────────────── */
  if (estado === "consentimento" || estado === "erro") {
    return (
      <Shell>
        <div className="rounded-2xl border border-humano/20 bg-humano/[0.06] p-6">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-humano/15 text-humano">
              <Video className="h-5 w-5" />
            </span>
            <h1 className="font-display text-lg font-semibold text-ink">
              Atendimento por vídeo
            </h1>
          </div>

          <div className="space-y-3 text-sm text-ink/85">
            <p>
              Você foi convidado(a) para uma teleconsulta com um(a) profissional de saúde. Ao
              entrar, sua câmera e microfone serão usados para a conversa em tempo real.
            </p>
            <div className="flex items-start gap-2 rounded-xl bg-fill/[0.03] p-3 text-xs text-ink-muted ring-1 ring-inset ring-line/10">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ia" />
              <span>
                O conteúdo da conversa é sigiloso e fica no perímetro da clínica. A plataforma não
                grava o vídeo nem armazena o que é dito. Apenas o profissional decide os próximos
                passos — a tecnologia é apoio, a decisão é humana.
              </span>
            </div>
          </div>

          {erro && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-alerta/40 bg-alerta/10 p-3 text-sm text-alerta">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {erro}
            </div>
          )}

          <label className="mt-4 block">
            <span className="mb-1 block text-[11px] uppercase tracking-wider text-ink-muted">
              Como quer ser chamado(a)? (opcional)
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome ou apelido"
              maxLength={120}
              className="w-full rounded-xl border border-line/10 bg-navy-deep/30 px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted/50 focus:border-humano/40"
            />
          </label>

          <button
            onClick={entrar}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-humano px-4 py-3 text-sm font-semibold text-onaccent transition hover:bg-humano/90"
          >
            <Video className="h-4 w-4" /> Concordo e quero entrar
          </button>
          <p className="mt-2 text-center text-[11px] text-ink-muted">
            Ao entrar, você concorda com o atendimento por vídeo descrito acima.
          </p>
        </div>
      </Shell>
    );
  }

  /* ── conectando / em chamada ───────────────────────────────────────────── */
  return (
    <Shell wide>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line/10 bg-navy-deep/60 sm:aspect-video">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={cn(
            "h-full w-full object-cover",
            psicologoPresente ? "opacity-100" : "opacity-0",
          )}
        />
        {!psicologoPresente && (
          <div className="absolute inset-0 grid place-items-center text-center text-sm text-ink-muted">
            <div>
              {estado === "conectando" ? (
                <Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin opacity-60" />
              ) : (
                <Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin opacity-40" />
              )}
              {estado === "conectando" ? "Entrando na sala…" : "Aguardando o profissional…"}
            </div>
          </div>
        )}

        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute bottom-3 right-3 h-24 w-20 rounded-xl border border-humano/30 object-cover shadow-lg sm:h-28 sm:w-40",
            estado === "conectado" && camOn ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={alternarMic}
          aria-pressed={micOn}
          aria-label={micOn ? "Desligar microfone" : "Ligar microfone"}
          className={cn(
            "grid h-12 w-12 place-items-center rounded-full ring-1 ring-inset transition",
            micOn
              ? "bg-fill/5 text-ink ring-line/10 hover:bg-fill/10"
              : "bg-alerta/15 text-alerta ring-alerta/25",
          )}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button
          onClick={alternarCam}
          aria-pressed={camOn}
          aria-label={camOn ? "Desligar câmera" : "Ligar câmera"}
          className={cn(
            "grid h-12 w-12 place-items-center rounded-full ring-1 ring-inset transition",
            camOn
              ? "bg-fill/5 text-ink ring-line/10 hover:bg-fill/10"
              : "bg-alerta/15 text-alerta ring-alerta/25",
          )}
        >
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        <button
          onClick={sair}
          aria-label="Sair da chamada"
          className="grid h-12 w-12 place-items-center rounded-full bg-alerta text-onaccent transition hover:bg-alerta/90"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </Shell>
  );
}

/** Casca mobile-first centralizada com marca PrevIA. */
function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-app px-4 py-8">
      <div className={cn("w-full", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="mb-5 flex items-center justify-center gap-2 text-sm text-ink-muted">
          <span className="font-display text-base font-semibold tracking-tight text-ink">
            Prev<span className="text-ia">IA</span>
          </span>
          <span className="text-ink-muted">· Teleconsulta</span>
        </div>
        {children}
      </div>
    </div>
  );
}
