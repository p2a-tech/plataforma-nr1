"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

/**
 * Botão "Copiar link de campanha" — client component. Compõe a URL absoluta
 * a partir da `path` (deterministicamente derivada no servidor) + window.origin.
 */
export function CopyLinkButton({ path }: { path: string }) {
  const [ok, setOk] = useState(false);

  async function copiar() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${path}`
        : path;
    try {
      await navigator.clipboard.writeText(url);
      setOk(true);
      setTimeout(() => setOk(false), 1800);
    } catch {
      /* fallback silencioso */
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex items-center gap-1.5 rounded-md bg-ia/15 px-2.5 py-1.5 text-xs font-medium text-ia ring-1 ring-inset ring-ia/25 transition hover:bg-ia/25"
      aria-label="Copiar link de campanha"
    >
      {ok ? (
        <>
          <Check className="h-3.5 w-3.5" /> Copiado
        </>
      ) : (
        <>
          <Link2 className="h-3.5 w-3.5" /> Copiar link
        </>
      )}
    </button>
  );
}
