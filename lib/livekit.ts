import "server-only";
import { AccessToken } from "livekit-server-sdk";

/**
 * Adapter LiveKit (WebRTC) — teleconsulta ao vivo. Server-only.
 *
 * Production-shaped (padrão do projeto, igual ao WhatsApp/Pixel): assim que as
 * três variáveis estiverem setadas (LIVEKIT_API_KEY + LIVEKIT_API_SECRET +
 * LIVEKIT_URL), a videochamada passa a funcionar. Sem elas, `liveKitConfigurado`
 * é false e os endpoints/telas degradam com um aviso claro — nunca quebram.
 *
 * O TOKEN é mintado SEMPRE no servidor (a API_SECRET nunca chega ao browser).
 * O `LIVEKIT_URL` (endereço público do SFU, ex.: wss://...) é o único valor que
 * o cliente precisa — e ele vem junto na resposta do endpoint de token, não
 * hardcoded no bundle.
 *
 * ARQUITETURA v1 (in-app): a transcrição roda no NAVEGADOR (Web Speech API) e
 * só o agregado anônimo cruza a barreira, igual ao fluxo de anexar transcrição.
 *
 * UPGRADE FUTURO (fora do escopo desta v1): para transcrição de maior acurácia e
 * gravação server-side, plugar um `clinic-agent` usando LiveKit Agents
 * (server-side) + Deepgram como STT. Isso roda no perímetro da clínica e
 * mantém a mesma barreira: só o resultado estruturado é devolvido ao sistêmico.
 */

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

/** Endereço público (wss://) do SFU LiveKit — exposto ao client via endpoint. */
export const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "";

/** True só quando as três variáveis necessárias estão presentes. */
export const liveKitConfigurado = Boolean(API_KEY && API_SECRET && LIVEKIT_URL);

/** TTL padrão do token de sala (2h cobre uma sessão clínica longa). */
const TTL = process.env.LIVEKIT_TOKEN_TTL ?? "2h";

export interface TokenSalaParams {
  /** Nome da sala (uma por sessão de teleconsulta). */
  sala: string;
  /** Identidade única do participante dentro da sala. */
  identidade: string;
  /** Nome de exibição (ex.: "Psicólogo" ou um apelido do paciente). */
  nome?: string;
  /**
   * Se pode publicar áudio/vídeo. Psicólogo e paciente publicam (true). Um
   * eventual observador (não usado hoje) entraria com false.
   */
  podePublicar?: boolean;
}

/**
 * Minta um AccessToken assinado para a sala. Lança erro claro se a teleconsulta
 * não estiver configurada (o caller — route handler — deve checar
 * `liveKitConfigurado` antes e responder 503, mas guardamos aqui também).
 *
 * `toJwt()` é assíncrono no livekit-server-sdk v2 → esta função é async.
 */
export async function criarTokenSala({
  sala,
  identidade,
  nome,
  podePublicar = true,
}: TokenSalaParams): Promise<string> {
  if (!liveKitConfigurado) {
    throw new Error(
      "Teleconsulta não configurada: defina LIVEKIT_API_KEY, LIVEKIT_API_SECRET e LIVEKIT_URL.",
    );
  }

  const at = new AccessToken(API_KEY, API_SECRET, {
    identity: identidade,
    name: nome,
    ttl: TTL,
  });

  at.addGrant({
    roomJoin: true,
    room: sala,
    canPublish: podePublicar,
    canSubscribe: true,
    // Convidado/paciente não administra a sala; só publica/assina mídia.
    roomAdmin: false,
    roomCreate: false,
    canPublishData: true,
  });

  return at.toJwt();
}

/** Gera um nome de sala anônimo (sem PII) — 'tc-' + 16 hex. */
export function novaSalaAnonima(): string {
  // Web Crypto está disponível no runtime Node moderno (globalThis.crypto).
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `tc-${hex}`;
}
