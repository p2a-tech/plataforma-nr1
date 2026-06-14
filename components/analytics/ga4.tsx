"use client";

import Script from "next/script";

/**
 * Google Analytics 4 — só renderiza se NEXT_PUBLIC_GA_MEASUREMENT_ID estiver
 * setado. Mesma estratégia do Meta Pixel: afterInteractive p/ não atrasar LCP.
 *
 * O id deve começar com "G-" (formato GA4).
 */
export function GA4() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;

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
