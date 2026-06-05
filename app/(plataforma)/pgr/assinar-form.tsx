"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Loader2, ShieldCheck } from "lucide-react";

const PAPEIS = [
  "Engenheiro(a) de Segurança do Trabalho",
  "Técnico(a) de Segurança do Trabalho",
  "Médico(a) do Trabalho",
  "Responsável SESMT",
];

export function AssinarForm({
  proximaRevisao,
  hashCurto,
}: {
  proximaRevisao: number;
  hashCurto: string;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState(PAPEIS[0]);
  const [registro, setRegistro] = useState("");
  const [declaro, setDeclaro] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const assinar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!declaro) {
      setErro("Confirme a declaração para assinar.");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/pgr/assinar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assinante_nome: nome,
          assinante_papel: papel,
          assinante_registro: registro || undefined,
          declaro: true,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.erro ?? "Falha ao assinar");
        return;
      }
      router.refresh();
    } catch {
      setErro("Erro de conexão");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={assinar} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted">Nome completo</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          placeholder="Ex.: Marina Alves"
          className="w-full rounded-lg border border-line/10 bg-fill/[0.03] px-3 py-2 text-sm text-ink outline-none focus:border-ia/40"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted">Função / responsabilidade</label>
        <select
          value={papel}
          onChange={(e) => setPapel(e.target.value)}
          className="w-full rounded-lg border border-line/10 bg-fill/[0.03] px-3 py-2 text-sm text-ink outline-none focus:border-ia/40"
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p} className="bg-navy-panel">
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted">Registro profissional (CREA/CRM/MTE)</label>
        <input
          value={registro}
          onChange={(e) => setRegistro(e.target.value)}
          placeholder="Opcional"
          className="w-full rounded-lg border border-line/10 bg-fill/[0.03] px-3 py-2 text-sm text-ink outline-none focus:border-ia/40"
        />
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border border-line/10 bg-fill/[0.02] p-3 text-xs leading-relaxed text-ink/80">
        <input
          type="checkbox"
          checked={declaro}
          onChange={(e) => setDeclaro(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#00C2D1]"
        />
        <span>
          Declaro, como responsável técnico, que revisei o PGR (rev {proximaRevisao}, hash{" "}
          <span className="font-mono">{hashCurto}…</span>) e assino digitalmente esta versão, ciente
          de que a IA atua como copiloto e a responsabilidade da decisão é humana.
        </span>
      </label>

      {erro && (
        <div className="rounded-lg bg-alerta/10 px-3 py-2 text-xs text-alerta ring-1 ring-inset ring-alerta/25">
          {erro}
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-ia px-4 py-2.5 text-sm font-semibold text-onaccent transition hover:bg-ia/90 disabled:opacity-60"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
        Assinar PGR (rev {proximaRevisao})
      </button>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-ok" /> Assinatura selada com HMAC e datada
      </p>
    </form>
  );
}
