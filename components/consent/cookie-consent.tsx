"use client";

import { useCallback, useEffect, useState } from "react";
import { Cookie, ShieldCheck, X } from "lucide-react";
import {
  EVENTO_ABRIR_CONSENT,
  lerConsentimento,
  salvarConsentimento,
} from "@/lib/consent";

/**
 * Banner de consentimento de cookies (LGPD).
 *
 * - Aparece no rodapé na 1ª visita (sem decisão salva).
 * - Botões: "Aceitar" (analytics on), "Recusar" (analytics off) e
 *   "Preferências" → abre o detalhe granular (essenciais vs. analytics).
 * - Reabre quando recebe o evento `previa:abrir-consent` (link do footer).
 *
 * A decisão é gravada por lib/consent.ts (cookie ~180d + localStorage) e os
 * gates de analytics (MetaPixel/GA4) reagem ao evento `previa:consent-alterado`.
 */
export function CookieConsent() {
  // null = ainda não decidiu se mostra (evita flash no SSR/hydration)
  const [visivel, setVisivel] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [detalhe, setDetalhe] = useState(false);

  // Decide a visibilidade só no client (cookie/localStorage não existem no SSR)
  useEffect(() => {
    setPronto(true);
    if (!lerConsentimento()) setVisivel(true);

    function abrir() {
      setDetalhe(false);
      setVisivel(true);
    }
    window.addEventListener(EVENTO_ABRIR_CONSENT, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_CONSENT, abrir);
  }, []);

  const decidir = useCallback((analytics: boolean) => {
    salvarConsentimento(analytics);
    setVisivel(false);
    setDetalhe(false);
  }, []);

  if (!pronto || !visivel) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 md:px-5 md:pb-5"
    >
      <div className="panel mx-auto max-w-3xl overflow-hidden p-4 shadow-glow md:p-5">
        <div className="flex items-start gap-3">
          <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-ia/15 text-ia sm:grid">
            <Cookie className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                Sua privacidade
              </h2>
              <button
                type="button"
                onClick={() => decidir(false)}
                aria-label="Fechar e recusar cookies de analytics"
                className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-muted transition hover:bg-fill/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Usamos cookies essenciais para o funcionamento do site e, com sua
              autorização, cookies de análise (Meta Pixel e Google Analytics) para
              entender o uso e melhorar a experiência. Você decide.{" "}
              <a href="/privacidade" className="text-ia underline hover:brightness-110">
                Política de Privacidade
              </a>
              .
            </p>

            {detalhe && (
              <div className="mt-4 space-y-2.5">
                <div className="flex items-start gap-3 rounded-xl border border-line/10 bg-fill/5 p-3.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        Essenciais
                      </span>
                      <span className="tag bg-ok/15 text-ok ring-1 ring-inset ring-ok/25">
                        Sempre ativos
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      Necessários para segurança, sessão e funcionamento básico.
                      Não podem ser desativados.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-line/10 bg-fill/5 p-3.5">
                  <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-ia" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-ink">
                      Análise e marketing
                    </span>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      Meta Pixel e Google Analytics 4 (com IP anonimizado). Só
                      carregam após o seu aceite.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {!detalhe && (
                <button
                  type="button"
                  onClick={() => setDetalhe(true)}
                  className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-muted transition hover:text-ink sm:mr-auto"
                >
                  Preferências
                </button>
              )}
              <button
                type="button"
                onClick={() => decidir(false)}
                className="rounded-xl border border-line/15 bg-fill/5 px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ia/40"
              >
                {detalhe ? "Salvar só essenciais" : "Recusar"}
              </button>
              <button
                type="button"
                onClick={() => decidir(true)}
                className="rounded-xl bg-ia px-4 py-2.5 text-sm font-semibold text-onaccent shadow-glow transition hover:brightness-110"
              >
                {detalhe ? "Aceitar análise" : "Aceitar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
