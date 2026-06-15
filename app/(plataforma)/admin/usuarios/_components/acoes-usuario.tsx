"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound, Power, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ações inline por usuário na tabela: ativar/desativar e resetar senha.
 * PATCH /api/admin/usuarios/[email].
 */
export function AcoesUsuario({ email, ativo: ativoInicial }: { email: string; ativo: boolean }) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(ativoInicial);
  const [busy, setBusy] = useState<null | "ativo" | "senha">(null);
  const [pending, startTransition] = useTransition();
  const [novaSenha, setNovaSenha] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const ocupado = busy !== null || pending;

  async function toggleAtivo() {
    const novo = !ativo;
    setAtivo(novo);
    setBusy("ativo");
    try {
      const res = await fetch(`/api/admin/usuarios/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "ativar", ativo: novo }),
      });
      if (!res.ok) {
        setAtivo(!novo);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setAtivo(!novo);
    } finally {
      setBusy(null);
    }
  }

  async function resetarSenha() {
    if (!confirm(`Gerar nova senha temporária para ${email}?`)) return;
    setBusy("senha");
    setNovaSenha(null);
    try {
      const res = await fetch(`/api/admin/usuarios/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "resetar_senha" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setNovaSenha(data.senhaTemporaria ?? null);
    } catch {
      /* noop */
    } finally {
      setBusy(null);
    }
  }

  async function copiar() {
    if (!novaSenha) return;
    try {
      await navigator.clipboard.writeText(novaSenha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleAtivo}
          disabled={ocupado}
          role="switch"
          aria-checked={ativo}
          aria-label={ativo ? "Desativar usuário" : "Ativar usuário"}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
            ativo
              ? "bg-ok/15 text-ok ring-ok/25 hover:bg-ok/20"
              : "bg-fill/5 text-ink-muted ring-line/10 hover:bg-fill/10",
            ocupado && "opacity-60",
          )}
        >
          {busy === "ativo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
          {ativo ? "Ativo" : "Inativo"}
        </button>
        <button
          type="button"
          onClick={resetarSenha}
          disabled={ocupado}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border border-line/15 px-2 py-1 text-xs text-ink-muted hover:bg-fill/10 hover:text-ink",
            ocupado && "opacity-60",
          )}
          title="Gerar nova senha temporária"
        >
          {busy === "senha" ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
          Senha
        </button>
      </div>

      {novaSenha && (
        <div className="flex items-center gap-1.5 rounded-lg border border-ia/20 bg-ia/[0.04] px-2 py-1">
          <code className="select-all font-mono text-[11px] text-ink">{novaSenha}</code>
          <button
            type="button"
            onClick={copiar}
            className="text-ink-muted hover:text-ink"
            aria-label="Copiar senha"
          >
            {copiado ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      )}
    </div>
  );
}
