import type { Metadata } from "next";
import { liveKitConfigurado } from "@/lib/livekit";
import { SalaConvidado } from "./convidado";

/**
 * Página pública do PACIENTE/convidado: /tc/[sala]  (SEM auth).
 *
 * Entra na sala LiveKit como convidado (token via /api/atendimento/ao-vivo/convidado).
 * Só vídeo/áudio — não administra a sala. Mobile-first. Mostra aviso de
 * consentimento de atendimento por vídeo antes de entrar.
 *
 * A `sala` vem da URL (nome anônimo 'tc-…' gerado pelo psicólogo). Não há PII
 * na rota nem no token. Degrada com aviso se a teleconsulta não estiver
 * configurada no servidor.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teleconsulta · PrevIA",
  description: "Sala de atendimento por vídeo.",
  robots: { index: false, follow: false },
};

export default function TeleconsultaConvidadoPage({
  params,
}: {
  params: { sala: string };
}) {
  return (
    <SalaConvidado sala={params.sala} configurado={liveKitConfigurado} />
  );
}
