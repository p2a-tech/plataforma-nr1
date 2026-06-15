"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RadarRings } from "@/components/brand/radar-rings";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    try {
      await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Por design: mesmo em erro de rede mostramos a mensagem genérica.
    } finally {
      setCarregando(false);
      setEnviado(true);
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

        <h1 className="font-display text-xl font-semibold text-ink">Esqueci minha senha</h1>
        <p className="mb-5 mt-1 text-xs text-ink-muted">
          Informe seu e-mail e enviaremos um link para criar uma nova senha.
        </p>

        {enviado ? (
          <div className="rounded-xl border border-ok/25 bg-ok/10 px-4 py-3 text-sm text-ink">
            Se existir uma conta com esse e-mail, enviaremos o link de redefinição em
            instantes. Verifique também a caixa de spam.
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-line/10 bg-fill/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ia/50 focus:ring-2 focus:ring-ia/20"
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-ia px-4 py-3 text-sm font-semibold text-onaccent transition-all hover:bg-ia/90 disabled:opacity-60"
            >
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar link de redefinição
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
        </Link>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-ok" />
          Link válido por 1 hora · uso único
        </div>
      </div>
    </div>
  );
}
