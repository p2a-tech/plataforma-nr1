"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RadarRings } from "@/components/brand/radar-rings";

const SENHA_MIN = 8;

function FormRedefinir() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!token) {
      setErro("Link inválido. Solicite uma nova redefinição.");
      return;
    }
    if (senha.length < SENHA_MIN) {
      setErro(`A senha precisa ter no mínimo ${SENHA_MIN} caracteres.`);
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);
    try {
      const r = await fetch("/api/auth/reset/confirmar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, novaSenha: senha }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(j.erro ?? "Não foi possível redefinir a senha.");
        return;
      }
      setSucesso(true);
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setCarregando(false);
    }
  };

  if (sucesso) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-ok/25 bg-ok/10 px-4 py-3 text-sm text-ink">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" />
          Senha redefinida com sucesso. Já pode entrar com a nova senha.
        </div>
        <Link
          href="/login"
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-ia px-4 py-3 text-sm font-semibold text-onaccent transition-all hover:bg-ia/90"
        >
          Ir para o login
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submeter} className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-muted">Nova senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-xl border border-line/10 bg-fill/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ia/50 focus:ring-2 focus:ring-ia/20"
        />
        <p className="mt-1 text-[11px] text-ink-muted">Mínimo de {SENHA_MIN} caracteres.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-muted">Confirmar nova senha</label>
        <input
          type="password"
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          autoComplete="new-password"
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
        Redefinir senha
      </button>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-deep px-6">
      <RadarRings className="opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_400px_at_30%_10%,rgba(0,194,209,0.10),transparent)]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8">
          <Logo size="md" withTagline />
        </div>

        <h1 className="font-display text-xl font-semibold text-ink">Criar nova senha</h1>
        <p className="mb-5 mt-1 text-xs text-ink-muted">Escolha uma senha forte e fácil de lembrar.</p>

        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          }
        >
          <FormRedefinir />
        </Suspense>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-ok" />
          Sessão segura · LGPD
        </div>
      </div>
    </div>
  );
}
