/**
 * Consentimento de cookies (LGPD) — helper client-safe.
 *
 * NÃO importa `server-only`: roda no client (banner, gates de analytics) e
 * também é puro o suficiente para ser testado em Node (parse do cookie).
 *
 * Decisão persistida em:
 *  - cookie `previa_consent` (validade ~180 dias) → sobrevive a navegações SSR;
 *  - espelho em localStorage → leitura síncrona no boot do client sem parse de cookie.
 *
 * Formato: { v: 1, analytics: boolean, ts: number(ms) }.
 * Categoria "essenciais" é sempre considerada concedida (cookies estritamente
 * necessários não pedem opt-in pela LGPD); só `analytics` é opcional.
 */

export const CONSENT_COOKIE = "previa_consent";
export const CONSENT_VERSION = 1;
/** ~180 dias em segundos (cookie) e ms (cálculo de expiração). */
export const CONSENT_MAX_AGE_DIAS = 180;
const CONSENT_MAX_AGE_SEG = CONSENT_MAX_AGE_DIAS * 24 * 60 * 60;

/** Evento disparado para reabrir o banner (ex.: link "Gerenciar cookies"). */
export const EVENTO_ABRIR_CONSENT = "previa:abrir-consent";
/** Evento disparado quando a decisão muda (gates de analytics reagem a ele). */
export const EVENTO_CONSENT_ALTERADO = "previa:consent-alterado";

export interface Consentimento {
  /** Versão do schema — permite reexibir o banner se as finalidades mudarem. */
  v: number;
  /** Aceitou cookies de analytics/marketing (Meta Pixel, GA4). */
  analytics: boolean;
  /** Timestamp (ms) da decisão. */
  ts: number;
}

/**
 * Faz o parse de uma string JSON de consentimento (vinda de cookie/localStorage).
 * Tolerante a lixo: retorna null se inválida, fora de versão ou malformada.
 * Pura — base dos testes.
 */
export function parseConsentimento(raw: string | null | undefined): Consentimento | null {
  if (!raw) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const c = obj as Record<string, unknown>;
  if (c.v !== CONSENT_VERSION) return null; // versão divergente → trata como ausente
  if (typeof c.analytics !== "boolean") return null;
  const ts = typeof c.ts === "number" && Number.isFinite(c.ts) ? c.ts : 0;
  return { v: CONSENT_VERSION, analytics: c.analytics, ts };
}

/** Decide se analytics está liberado a partir de um consentimento já parseado. Puro. */
export function consentiuAnalyticsDe(c: Consentimento | null): boolean {
  return c?.analytics === true;
}

/* -------------------------------------------------------------------------- */
/*  Acesso ao ambiente do browser (no-op no server)                           */
/* -------------------------------------------------------------------------- */

function lerCookieRaw(nome: string): string | null {
  if (typeof document === "undefined") return null;
  const alvo = `${nome}=`;
  for (const parte of document.cookie.split(";")) {
    const p = parte.trim();
    if (p.startsWith(alvo)) {
      try {
        return decodeURIComponent(p.slice(alvo.length));
      } catch {
        return p.slice(alvo.length);
      }
    }
  }
  return null;
}

/**
 * Lê o consentimento atual. Prefere o cookie (canônico), cai pro localStorage.
 * Retorna null se nenhuma decisão foi tomada (→ banner deve aparecer).
 */
export function lerConsentimento(): Consentimento | null {
  if (typeof window === "undefined") return null;
  const doCookie = parseConsentimento(lerCookieRaw(CONSENT_COOKIE));
  if (doCookie) return doCookie;
  try {
    return parseConsentimento(window.localStorage.getItem(CONSENT_COOKIE));
  } catch {
    return null;
  }
}

/** `true` somente se o usuário decidiu E liberou analytics. */
export function consentiuAnalytics(): boolean {
  return consentiuAnalyticsDe(lerConsentimento());
}

/** `true` se já existe qualquer decisão salva (aceitar OU recusar). */
export function temDecisao(): boolean {
  return lerConsentimento() !== null;
}

/**
 * Persiste a decisão (cookie + localStorage) e avisa os ouvintes
 * (gates de analytics) via CustomEvent + storage event implícito.
 */
export function salvarConsentimento(analytics: boolean): Consentimento {
  const consent: Consentimento = { v: CONSENT_VERSION, analytics, ts: Date.now() };
  if (typeof window === "undefined") return consent;

  const json = JSON.stringify(consent);
  try {
    const seguro = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${CONSENT_COOKIE}=${encodeURIComponent(json)}` +
      `; Max-Age=${CONSENT_MAX_AGE_SEG}; Path=/; SameSite=Lax${seguro}`;
  } catch {
    /* no-op */
  }
  try {
    window.localStorage.setItem(CONSENT_COOKIE, json);
  } catch {
    /* no-op */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_CONSENT_ALTERADO, { detail: consent }));
  } catch {
    /* no-op */
  }
  return consent;
}

/** Dispara o evento que faz o banner reabrir (link "Gerenciar cookies"). */
export function abrirPreferencias(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_CONSENT));
  } catch {
    /* no-op */
  }
}
