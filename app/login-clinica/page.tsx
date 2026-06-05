"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, HeartHandshake, ArrowLeft, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RadarRings } from "@/components/brand/radar-rings";

export default function LoginClinicaPage() {
  const router = useRouter();
  const [email, setEmail] = useState("clinica@translog.com.br");
  const [senha, setSenha] = useState("previa123");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch("/api/auth/clinica", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.erro ?? "Falha no login");
        return;
      }
      router.push("/atendimento");
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_400px_at_70%_10%,rgba(255,107,53,0.10),transparent)]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8">
          <Logo size="md" withTagline />
        </div>

        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-humano/15 text-humano ring-1 ring-inset ring-humano/25">
            <HeartHandshake className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Portal da Clínica</h1>
            <p className="text-xs text-ink-muted">Acesso à área de atendimento</p>
          </div>
        </div>

        <form onSubmit={entrar} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-line/10 bg-fill/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-humano/50 focus:ring-2 focus:ring-humano/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-xl border border-line/10 bg-fill/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-humano/50 focus:ring-2 focus:ring-humano/20"
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
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-humano px-4 py-3 text-sm font-semibold text-onaccent transition-all hover:bg-humano/90 disabled:opacity-60"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Entrar na área da clínica
            {!carregando && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </form>

        <div className="mt-4 rounded-lg border border-line/10 bg-fill/[0.02] px-3 py-2 text-[11px] text-ink-muted">
          Demo: <span className="text-ink/80">clinica@translog.com.br</span> · senha{" "}
          <span className="text-ink/80">previa123</span>
        </div>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao painel de demonstração
        </Link>
      </div>
    </div>
  );
}
