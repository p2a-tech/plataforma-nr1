"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Brain, HeartPulse, Lock, Sun, Moon, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { P2ALogo } from "@/components/brand/p2a-logo";
import { useTheme } from "@/lib/theme";
import { brand } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { tema, toggleTema } = useTheme();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const entrar = async () => {
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, senha }),
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
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Alternar tema claro/escuro */}
      <button
        onClick={toggleTema}
        className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-lg bg-fill/5 text-ink-muted ring-1 ring-inset ring-line/10 transition-colors hover:bg-fill/10 hover:text-ink"
        aria-label={tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
        title={tema === "dark" ? "Tema claro" : "Tema escuro"}
      >
        {tema === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>

      {/* Painel de marca (esquerda) */}
      <div className="relative hidden overflow-hidden bg-navy-deep lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_400px_at_30%_20%,rgba(0,194,209,0.12),transparent)]" />

        <div className="relative">
          <Logo size="lg" withTagline />
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight text-ink">
            Conformidade com a nova <span className="text-ia">NR-1</span>, com{" "}
            <span className="text-humano">cuidado humano</span> de verdade.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            A IA cuida do compliance organizacional (nível NR-1). A clínica parceira cuida do
            indivíduo (nível NR-7). Um ecossistema Human-in-the-Loop para riscos psicossociais.
          </p>

          <div className="mt-8 space-y-3">
            <Marcador icon={<Brain className="h-4 w-4" />} tone="ia" texto="Radar de IA — escuta ativa e anônima" />
            <Marcador icon={<HeartPulse className="h-4 w-4" />} tone="humano" texto="Acolhimento clínico em telemedicina" />
            <Marcador icon={<Lock className="h-4 w-4" />} tone="ia" texto="Anonimato real (k-anonymity) e LGPD" />
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-ink-muted">
          <span>© {new Date().getFullYear()} {brand.name} — uma solução</span>
          <P2ALogo size="xs" />
        </div>
      </div>

      {/* Formulário (direita) */}
      <div className="relative flex items-center justify-center px-6 py-12">
        <div className="relative w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo size="md" withTagline />
          </div>

          <div className="mb-6">
            <h1 className="font-display text-2xl font-semibold text-ink">Bem-vindo de volta</h1>
            <p className="mt-1 text-sm text-ink-muted">Entre para acessar o painel da plataforma.</p>
          </div>

          {/* Credenciais */}
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">E-mail corporativo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && entrar()}
                placeholder="voce@empresa.com.br"
                className="w-full rounded-xl border border-line/8 bg-fill/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ia/50 focus:ring-2 focus:ring-ia/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && entrar()}
                placeholder="••••••••"
                className="w-full rounded-xl border border-line/8 bg-fill/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ia/50 focus:ring-2 focus:ring-ia/20"
              />
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
            className="group mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-ia px-4 py-3 text-sm font-semibold text-onaccent transition-all hover:bg-ia/90 hover:shadow-glow disabled:opacity-60"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Entrar na plataforma
            {!carregando && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </button>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-ok" />
            Sessão segura (HMAC) · LGPD
          </div>
        </div>
      </div>
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
