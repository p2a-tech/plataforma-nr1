"use client";

import { useEffect, useState } from "react";
import {
  EVENTO_CONSENT_ALTERADO,
  consentiuAnalytics,
} from "@/lib/consent";

/**
 * Hook compartilhado pelos gates de analytics (MetaPixel/GA4).
 *
 * Retorna `false` no SSR e no 1º render do client (evita injetar script antes
 * de saber a decisão), e passa a `true` somente após confirmar — no client —
 * que o usuário consentiu com analytics. Reage a:
 *  - `previa:consent-alterado` (decisão salva no banner desta aba);
 *  - `storage` (decisão salva em outra aba).
 */
export function useConsentimentoAnalytics(): boolean {
  const [consentiu, setConsentiu] = useState(false);

  useEffect(() => {
    const atualizar = () => setConsentiu(consentiuAnalytics());
    atualizar();
    window.addEventListener(EVENTO_CONSENT_ALTERADO, atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(EVENTO_CONSENT_ALTERADO, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  return consentiu;
}
