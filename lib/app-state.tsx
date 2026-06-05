"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { profiles, type ProfileId, type Profile } from "@/lib/mock-data";

/**
 * Estado global do preview (client-side):
 *  - perfil selecionado (Gestor SST / Clínica / Admin) — persistido em localStorage
 *  - "modo apresentação" que percorre as telas principais automaticamente
 */

/** Telas percorridas no modo apresentação, na ordem. */
export const tourRotas = [
  "/dashboard",
  "/escuta",
  "/riscos",
  "/fluxo",
  "/clinica",
  "/conformidade",
  "/governanca",
] as const;

const TOUR_INTERVALO_MS = 7000;

interface AppState {
  profile: Profile;
  setProfileId: (id: ProfileId) => void;
  apresentando: boolean;
  toggleApresentacao: () => void;
  progresso: number; // 0-100 dentro do passo atual
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profileId, setProfileIdState] = useState<ProfileId>("sst");
  const [apresentando, setApresentando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Carrega perfil salvo
  useEffect(() => {
    const salvo = window.localStorage.getItem("previa:profile") as ProfileId | null;
    if (salvo && profiles.some((p) => p.id === salvo)) setProfileIdState(salvo);
  }, []);

  const setProfileId = (id: ProfileId) => {
    setProfileIdState(id);
    window.localStorage.setItem("previa:profile", id);
  };

  const pararTour = () => {
    if (timer.current) clearInterval(timer.current);
    if (progressTimer.current) clearInterval(progressTimer.current);
    timer.current = null;
    progressTimer.current = null;
    setApresentando(false);
    setProgresso(0);
  };

  const toggleApresentacao = () => {
    if (apresentando) {
      pararTour();
      return;
    }
    setApresentando(true);
    setProgresso(0);

    // Começa no início do tour
    const atualIdx = tourRotas.findIndex((r) => r === pathname);
    let idx = atualIdx === -1 ? 0 : atualIdx;
    router.push(tourRotas[idx]);

    timer.current = setInterval(() => {
      idx = (idx + 1) % tourRotas.length;
      setProgresso(0);
      router.push(tourRotas[idx]);
    }, TOUR_INTERVALO_MS);

    // Barra de progresso suave
    const passo = 100 / (TOUR_INTERVALO_MS / 100);
    progressTimer.current = setInterval(() => {
      setProgresso((p) => (p + passo >= 100 ? 100 : p + passo));
    }, 100);
  };

  // Limpeza
  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const profile = profiles.find((p) => p.id === profileId) ?? profiles[0];

  return (
    <Ctx.Provider value={{ profile, setProfileId, apresentando, toggleApresentacao, progresso }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp deve ser usado dentro de <AppProvider>");
  return ctx;
}
