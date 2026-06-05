"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Tema = "dark" | "light";

interface ThemeState {
  tema: Tema;
  setTema: (t: Tema) => void;
  toggleTema: () => void;
}

const Ctx = createContext<ThemeState | null>(null);

/** Aplica a classe de tema em <html> e persiste em localStorage. */
function aplicar(t: Tema) {
  const el = document.documentElement;
  el.classList.remove("dark", "light");
  el.classList.add(t);
  try {
    window.localStorage.setItem("previa:tema", t);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTemaState] = useState<Tema>("dark");

  // Sincroniza com a classe já aplicada pelo script anti-flash em <head>.
  useEffect(() => {
    const atual = document.documentElement.classList.contains("light") ? "light" : "dark";
    setTemaState(atual);
  }, []);

  const setTema = (t: Tema) => {
    setTemaState(t);
    aplicar(t);
  };

  const toggleTema = () => setTema(tema === "dark" ? "light" : "dark");

  return <Ctx.Provider value={{ tema, setTema, toggleTema }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  return ctx;
}
