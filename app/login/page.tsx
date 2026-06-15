"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RadarRings } from "@/components/brand/radar-rings";

export default function LoginPage() {
  return <LoginForm />;
}

/**
 * Aviso de sessão revogada (?desativado=1). useSearchParams exige um Suspense
 * boundary no Next 14 (App Router) — e o fallback NÃO pode usar useSearchParams,
 * por isso o uso fica isolado neste componente com fallback null.
 */
function AvisoDesativado() {
  const searchParams = useSearchParams();
  if (searchParams.get("desativado") !== "1") return null;
  return (
    <div className="mb-3 rounded-lg bg-alerta/10 px-3 py-2 text-xs text-alerta ring-1 ring-inset ring-alerta/25">
      Seu acesso foi encerrado. Fale com o administrador da sua organização.
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
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

        <Suspense fallback={null}>
          <AvisoDesativado />
        </Suspense>

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

        <div className="mt-4 text-center">
          <Link href="/esqueci-senha" className="text-xs text-ink-muted transition hover:text-ink">
            Esqueci minha senha
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-ok" />
          Sessão segura (HMAC) · LGPD
        </div>
      </div>
    </div>
  );
}
