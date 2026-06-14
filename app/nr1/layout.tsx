import type { Metadata } from "next";

/**
 * Layout próprio da landing page /nr1.
 * Sem sidebar/header da plataforma — é página pública para tráfego pago.
 * Força tema dark (a landing foi desenhada nele) sem quebrar o resto do app.
 */

export const metadata: Metadata = {
  title: "PrevIA · Conformidade NR-1 com IA + cuidado humano | P2A Tech",
  description:
    "A primeira plataforma brasileira de IA para riscos psicossociais. Cumpra a NR-1, gere PGR vivo, integre eSocial S-2240 e ofereça cuidado clínico aos seus colaboradores — em até 14 dias.",
  openGraph: {
    title: "PrevIA · Conformidade NR-1 com IA + cuidado humano",
    description:
      "Cumpra a NR-1 sem virar planilha. Escuta ativa por IA · PGR vivo · cuidado clínico via psicólogos parceiros. Demo grátis em 20min.",
    type: "website",
    siteName: "PrevIA",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "PrevIA · NR-1 com IA + cuidado humano",
    description:
      "Cumpra a NR-1 sem virar planilha. Demo grátis em 20min.",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1F3A",
};

export default function NR1Layout({ children }: { children: React.ReactNode }) {
  // O <html> raiz (em app/layout.tsx) já vem com a classe `dark` por padrão.
  // Aqui só fornecemos um wrapper que ignora o sidebar da plataforma.
  return <div className="bg-app min-h-screen">{children}</div>;
}
