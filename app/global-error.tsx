"use client";

/**
 * Fallback de erro de nível raiz. Só dispara quando o próprio root layout
 * quebra, então precisa renderizar seu próprio <html>/<body> e NÃO pode
 * depender do layout/CSS global — por isso usamos estilos inline.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#0A0F1C",
          color: "#E8EDF6",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              backgroundColor: "#070B14",
              boxShadow: "inset 0 0 0 1px rgba(0,194,209,0.30)",
              marginBottom: "20px",
            }}
          >
            <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#00C2D1" strokeOpacity="0.25" strokeWidth="1.5" />
              <circle cx="20" cy="20" r="10" fill="none" stroke="#00C2D1" strokeOpacity="0.5" strokeWidth="1.5" />
              <circle cx="20" cy="20" r="4" fill="#00C2D1" />
              <path d="M20 20 L34 12" stroke="#FF6B35" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>

          <h1
            style={{
              fontSize: "24px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              margin: "0 0 10px",
            }}
          >
            Algo saiu do esperado
          </h1>
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#9AA7BD",
              margin: "0 0 24px",
            }}
          >
            Tivemos um problema inesperado ao carregar o PrevIA. Nossa equipe foi
            notificada. Você pode tentar novamente.
          </p>

          <button
            onClick={() => reset()}
            style={{
              cursor: "pointer",
              border: "1px solid rgba(0,194,209,0.30)",
              backgroundColor: "rgba(0,194,209,0.12)",
              color: "#00C2D1",
              fontSize: "14px",
              fontWeight: 500,
              padding: "11px 22px",
              borderRadius: "12px",
            }}
          >
            Tentar novamente
          </button>

          {error?.digest && (
            <p style={{ marginTop: "20px", fontSize: "11px", color: "#5B6680" }}>
              Código de referência: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
