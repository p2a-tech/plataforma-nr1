"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, ShieldCheck, Brain, HeartPulse, Lock, Sun, Moon, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { P2ALogo } from "@/components/brand/p2a-logo";
import { useTheme } from "@/lib/theme";
import { profiles, brand, type ProfileId } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

// E-mails demo por perfil (senha previa123). Login real ao entrar.
const DEMO_EMAIL: Record<ProfileId, string> = {
  sst: "gestor@translog.com.br",
  clinica: "clinica@translog.com.br",
  admin: "admin@p2a.tech",
};

export default function LoginPage() {
  const router = useRouter();
  const { tema, toggleTema } = useTheme();
  const [perfil, setPerfil] = useState<ProfileId>("sst");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Etapa do fluxo: false = landing (info + botão); true = tela de login (card centralizado)
  const [mostrarLogin, setMostrarLogin] = useState(false);

  const entrar = async () => {
    setErro(null);
    setCarregando(true);
    try {
      window.localStorage.setItem("previa:profile", perfil);
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: DEMO_EMAIL[perfil], senha: "previa123" }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.erro ?? "Falha no login");
        return;
      }
      router.push(j.redirect ?? "/dashboard");
      router.refresh();
    } catch {
      setErro("Erro de conexão");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-navy-deep">
      {/* Fundo (desktop ≥1024px): foto da equipe cobrindo a tela inteira, em ambas as etapas */}
      <Image
        src="/login-equipe-gps-cover.jpg"
        alt="Profissionais do Grupo GPS"
        fill
        priority
        sizes="100vw"
        className="z-0 hidden object-cover object-bottom lg:block"
      />
      {/* Fundo no mobile: foto original ancorada embaixo */}
      <Image
        src="/login-equipe-gps.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="z-0 object-contain object-bottom lg:hidden"
      />
      {/* Overlays — na etapa de login escurece mais a tela toda para destacar o card central */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-0 transition-colors duration-500",
          mostrarLogin
            ? "bg-navy-deep/70"
            : "bg-gradient-to-b from-navy-deep/65 via-navy-deep/35 to-navy-deep/5 lg:bg-gradient-to-r lg:from-navy-deep/90 lg:via-navy-deep/30 lg:to-transparent",
        )}
      />
      <div className="pointer-events-none absolute inset-0 z-0 hidden bg-[radial-gradient(640px_340px_at_22%_12%,rgba(0,194,209,0.12),transparent)] lg:block" />

      {/* Alternar tema claro/escuro */}
      <button
        onClick={toggleTema}
        className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-lg bg-fill/5 text-ink-muted ring-1 ring-inset ring-line/10 transition-colors hover:bg-fill/10 hover:text-ink"
        aria-label={tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
        title={tema === "dark" ? "Tema claro" : "Tema escuro"}
      >
        {tema === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>

      {!mostrarLogin ? (
        /* ETAPA 1 — Landing: logo + informações encostados no topo, alinhados à esquerda */
        <div className="relative z-10 flex flex-1 flex-col p-8 lg:px-10 lg:pb-8 lg:pt-7">
          <Logo size="lg" withTagline />

          {/* Bloco de informações: no mobile largo; no desktop coluna estreita na faixa esquerda
              (não cobre o operário), descendo até ~a cintura */}
          <div className="mt-7 max-w-md lg:mt-[16vh] lg:max-w-[15rem]">
            <h2 className="font-display text-[26px] font-semibold leading-[1.15] text-ink lg:text-[21px]">
              Conformidade com a nova <span className="text-ia">NR-1</span>, com{" "}
              <span className="text-humano">cuidado humano</span> de verdade.
            </h2>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
              A IA cuida do compliance organizacional (nível NR-1). A clínica parceira cuida do
              indivíduo (nível NR-7).
            </p>

            <div className="mt-4 space-y-2">
              <Marcador icon={<Brain className="h-4 w-4" />} tone="ia" texto="Radar de IA — escuta ativa e anônima" />
              <Marcador icon={<HeartPulse className="h-4 w-4" />} tone="humano" texto="Acolhimento clínico em telemedicina" />
              <Marcador icon={<Lock className="h-4 w-4" />} tone="ia" texto="Anonimato real (k-anonymity) e LGPD" />
            </div>
          </div>

          {/* Único CTA da landing — empurrado para baixo, separado do texto */}
          <button
            onClick={() => setMostrarLogin(true)}
            className="group mt-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-ia px-4 py-3 text-sm font-semibold text-onaccent shadow-glow transition-all hover:bg-ia/90 lg:mt-12 lg:max-w-[15rem]"
          >
            Entrar na plataforma
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="mt-6 flex items-center gap-2 text-xs text-ink-muted">
            <span>© {new Date().getFullYear()} {brand.name} — uma solução</span>
            <P2ALogo size="xs" />
          </div>
        </div>
      ) : (
        /* ETAPA 2 — Tela de login: card (overlay) centralizado sobre a foto */
        <div className="relative z-10 flex flex-1 items-center justify-center p-6">
          <div className="relative w-full max-w-sm rounded-2xl bg-navy-deep/55 p-6 ring-1 ring-line/10 shadow-panel backdrop-blur-lg">
            {/* Voltar para a landing */}
            <button
              onClick={() => setMostrarLogin(false)}
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>

            <div className="mb-5 flex flex-col items-center text-center">
              <Logo size="sm" withTagline />
              <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Bem-vindo de volta</h1>
              <p className="mt-1 text-sm text-ink-muted">Entre para acessar o painel da plataforma.</p>
            </div>

            {/* Campos ilustrativos */}
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">E-mail corporativo</label>
                <input
                  type="email"
                  defaultValue="marina.alves@translog.com.br"
                  className="w-full rounded-xl border border-line/8 bg-fill/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ia/50 focus:ring-2 focus:ring-ia/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Senha</label>
                <input
                  type="password"
                  defaultValue="demonstracao"
                  className="w-full rounded-xl border border-line/8 bg-fill/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ia/50 focus:ring-2 focus:ring-ia/20"
                />
              </div>
            </div>

            {/* Seletor de perfil */}
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium text-ink-muted">Entrar como (demo)</label>
              <div className="grid grid-cols-3 gap-2">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPerfil(p.id)}
                    className={cn(
                      "rounded-xl border px-2 py-2.5 text-center transition-all",
                      perfil === p.id
                        ? "border-ia/40 bg-ia/10 text-ink shadow-glow"
                        : "border-line/8 bg-fill/[0.02] text-ink-muted hover:border-line/15 hover:text-ink",
                    )}
                  >
                    <span className="mx-auto mb-1 grid h-8 w-8 place-items-center rounded-lg bg-fill/5 text-xs font-semibold">
                      {p.iniciais}
                    </span>
                    <span className="block text-[11px] font-medium leading-tight">
                      {p.papel.split(" · ")[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {erro && (
              <div className="mt-3 rounded-lg bg-alerta/10 px-3 py-2 text-xs text-alerta ring-1 ring-inset ring-alerta/25">
                {erro}
              </div>
            )}

            <button
              onClick={entrar}
              disabled={carregando}
              className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-ia px-4 py-3 text-sm font-semibold text-onaccent transition-all hover:bg-ia/90 hover:shadow-glow disabled:opacity-60"
            >
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Entrar na plataforma
              {!carregando && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-ok" />
              Ambiente de demonstração — senha demo: previa123
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Marcador({
  icon,
  texto,
  tone,
}: {
  icon: React.ReactNode;
  texto: string;
  tone: "ia" | "humano";
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg ring-1",
          tone === "ia" ? "bg-ia/10 text-ia ring-ia/25" : "bg-humano/10 text-humano ring-humano/25",
        )}
      >
        {icon}
      </span>
      <span className="text-sm text-ink/90">{texto}</span>
    </div>
  );
}
