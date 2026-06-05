"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RadarRings } from "@/components/brand/radar-rings";
import { cn } from "@/lib/utils";

const DEMOS = [
  { papel: "sst", rotulo: "Gestor SST", email: "gestor@translog.com.br" },
  { papel: "clinica", rotulo: "Clínica", email: "clinica@translog.com.br" },
  { papel: "admin", rotulo: "Admin", email: "admin@p2a.tech" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("gestor@translog.com.br");
  const [senha, setSenha] = useState("previa123");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-deep px-6">
      <RadarRings className="opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_400px_at_30%_10%,rgba(0,194,209,0.10),transparent)]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8">
          <Logo size="md" withTagline />
        </div>

        <h1 className="font-display text-xl font-semibold text-ink">Acesso à plataforma</h1>
        <p className="mb-5 mt-1 text-xs text-ink-muted">Entre com suas credenciais.</p>

        <form onSubmit={entrar} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-line/10 bg-fill/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ia/50 focus:ring-2 focus:ring-ia/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-xl border border-line/10 bg-fill/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ia/50 focus:ring-2 focus:ring-ia/20"
            />
          </div>

          {erro && (
            <div className="rounded-lg bg-alerta/10 px-3 py-2 text-xs text-alerta ring-1 ring-inset ring-alerta/25">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-ia px-4 py-3 text-sm font-semibold text-onaccent transition-all hover:bg-ia/90 disabled:opacity-60"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Entrar
            {!carregando && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </form>

        {/* Atalhos de demonstração */}
        <div className="mt-4">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-muted">Entrar como (demo)</div>
          <div className="grid grid-cols-3 gap-2">
            {DEMOS.map((d) => (
              <button
                key={d.papel}
                onClick={() => {
                  setEmail(d.email);
                  setSenha("previa123");
                }}
                className={cn(
                  "rounded-lg border px-2 py-2 text-center text-xs transition",
                  email === d.email
                    ? "border-ia/40 bg-ia/10 text-ink"
                    : "border-line/10 bg-fill/[0.02] text-ink-muted hover:text-ink",
                )}
              >
                {d.rotulo}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-ink-muted">Senha demo: previa123</div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-ok" />
          Sessão segura (HMAC) · LGPD
        </div>
      </div>
    </div>
  );
}
