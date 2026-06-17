"use client";

import { abrirPreferencias } from "@/lib/consent";

/**
 * Link do footer que reabre o banner de consentimento (LGPD).
 * Client component mínimo — o resto do footer continua server-rendered.
 */
export function GerenciarCookies() {
  return (
    <button
      type="button"
      onClick={() => abrirPreferencias()}
      className="text-left hover:text-ink"
    >
      Gerenciar cookies
    </button>
  );
}
