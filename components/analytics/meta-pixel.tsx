"use client";

import Script from "next/script";
import { useConsentimentoAnalytics } from "./use-consentimento";

/**
 * Meta (Facebook) Pixel — só renderiza se:
 *  1) NEXT_PUBLIC_META_PIXEL_ID estiver setado; E
 *  2) o usuário consentiu com analytics (cookie LGPD `previa_consent`).
 *
 * Como é client component, lê o consentimento no client (useState/useEffect +
 * eventos de alteração). Sem env ou sem consentimento → null (no-op, não polui
 * o DOM/CSP e não dispara nenhuma chamada à Meta).
 *
 * O `<noscript>` (pixel-imagem) é igualmente condicionado ao consentimento.
 * `strategy="afterInteractive"` evita atrasar o LCP da landing.
 */
export function MetaPixel() {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const consentiu = useConsentimentoAnalytics();
  if (!id || !consentiu) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s){
              if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)
            }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${id}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
