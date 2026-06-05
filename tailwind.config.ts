import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fundos — variáveis CSS (trocam por tema claro/escuro). Ver globals.css
        navy: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)", // fundo principal
          panel: "rgb(var(--panel) / <alpha-value>)", // painéis / cards
          deep: "rgb(var(--deep) / <alpha-value>)", // superfície mais profunda (sidebar etc.)
        },
        // Texto — variáveis CSS
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
        },
        // Tokens semânticos para bordas (line) e preenchimentos sutis (fill)
        line: "rgb(var(--line) / <alpha-value>)",
        fill: "rgb(var(--fill) / <alpha-value>)",
        // Cor fixa para texto sobre superfícies de accent (botões ciano/laranja)
        onaccent: "#06243A",
        // Accent IA (plataforma) = ciano — fixo nos dois temas (consistente com os gráficos)
        ia: {
          DEFAULT: "#00C2D1",
          soft: "#06B6A4", // teal de apoio
        },
        // Accent humano (clínica) = laranja — fixo nos dois temas
        humano: {
          DEFAULT: "#FF6B35",
          soft: "#FFB020", // âmbar
        },
        // Estados
        ok: "#27AE60",
        alerta: "#E5484D",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        brand: ["var(--font-brand)", "var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        panel: "0 8px 30px rgba(2, 8, 20, 0.45)",
        glow: "0 0 0 1px rgba(0,194,209,0.18), 0 0 28px rgba(0,194,209,0.12)",
        glowHuman: "0 0 0 1px rgba(255,107,53,0.20), 0 0 28px rgba(255,107,53,0.12)",
      },
      keyframes: {
        radar: {
          "0%": { transform: "scale(0.4)", opacity: "0.55" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        flow: {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
      },
      animation: {
        radar: "radar 3s ease-out infinite",
        "fade-up": "fade-up 0.5s ease-out both",
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        flow: "flow 1s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
