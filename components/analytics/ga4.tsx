"use client";

import Script from "next/script";
import { useConsentimentoAnalytics } from "./use-consentimento";

/**
 * Google Analytics 4 — só renderiza se:
 *  1) NEXT_PUBLIC_GA_MEASUREMENT_ID estiver setado; E
 *  2) o usuário consentiu com analytics (cookie LGPD `previa_consent`).
 *
 * Lê o consentimento no client. Sem env ou sem consentimento → null (no-op):
 * nenhum script do Google é injetado e nenhum hit é enviado.
 *
 * O id deve começar com "G-" (formato GA4). `anonymize_ip` reduz o dado coletado.
 */
export function GA4() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const consentiu = useConsentimentoAnalytics();
  if (!id || !consentiu) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', '${id}', { anonymize_ip: true });
          `,
        }}
      />
    </>
  );
}
