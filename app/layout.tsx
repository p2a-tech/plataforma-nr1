import type { Metadata } from "next";
import { Inter, Fraunces, Exo_2 } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

// Aplica o tema salvo antes da pintura (evita "flash" do tema errado).
const themeScript = `(function(){try{var t=localStorage.getItem('previa:tema')||'dark';var e=document.documentElement;e.classList.remove('dark','light');e.classList.add(t==='light'?'light':'dark');}catch(e){}})();`;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Serif display elegante para títulos (ar de produto premium)
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Fonte geométrica/tech para o wordmark da marca da casa (P2A Tech)
const exo2 = Exo_2({
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "PrevIA — O Ecossistema Omni-SST",
  description:
    "Plataforma de IA para conformidade com a NR-1 e gestão de riscos psicossociais. Modelo Human-in-the-Loop. Por P2A Tech.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${fraunces.variable} ${exo2.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-app font-sans text-ink antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
