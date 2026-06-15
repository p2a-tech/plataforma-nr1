"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botão "Nova empresa" + modal de criação. Cliente porque precisa de estado
 * de formulário, POST e refresh do RSC payload. POST em /api/admin/empresas.
 */
export function NovaEmpresa() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segmento, setSegmento] = useState("");
  const [id, setId] = useState("");

  function reset() {
    setNome("");
    setCnpj("");
    setSegmento("");
    setId("");
    setErro(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Informe o nome da empresa.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/admin/empresas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          cnpj: cnpj.trim() || undefined,
          segmento: segmento.trim() || undefined,
          id: id.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(
          data?.erro === "id_duplicado"
            ? "Já existe uma empresa com esse identificador."
            : data?.detalhe?.[0] ?? "Falha ao criar empresa.",
        );
        return;
      }
      reset();
      setAberto(false);
      router.refresh();
    } catch {
      setErro("Sem conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-ia px-4 py-2 text-sm font-semibold text-onaccent shadow-glow hover:brightness-110"
      >
        <Plus className="h-4 w-4" /> Nova empresa
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nova-empresa-titulo"
          onClick={(e) => {
            if (e.target === e.currentTarget && !salvando) setAberto(false);
          }}
        >
          <div className="panel w-full max-w-md p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-ia" />
                <h2
                  id="nova-empresa-titulo"
                  className="font-display text-lg font-semibold text-ink"
                >
                  Nova empresa
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !salvando && setAberto(false)}
                className="text-ink-muted hover:text-ink"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <Campo
                label="Nome"
                value={nome}
                onChange={setNome}
                placeholder="Ex: Translog Brasil S.A."
                autoFocus
                required
              />
              <Campo
                label="CNPJ"
                value={cnpj}
                onChange={setCnpj}
                placeholder="00.000.000/0001-00 (opcional)"
              />
              <Campo
                label="Segmento"
                value={segmento}
                onChange={setSegmento}
                placeholder="Ex: Logística e Transporte (opcional)"
              />
              <Campo
                label="Identificador (slug)"
                value={id}
                onChange={(v) => setId(v.toLowerCase())}
                placeholder="Gerado automaticamente se vazio"
                hint="Apenas minúsculas, números e _. Deixe vazio para gerar."
              />

              {erro && (
                <p className="text-sm text-alerta" role="alert">
                  {erro}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => !salvando && setAberto(false)}
                  className="rounded-xl border border-line/15 px-4 py-2 text-sm text-ink-muted hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl bg-ia px-4 py-2 text-sm font-semibold text-onaccent shadow-glow hover:brightness-110",
                    salvando && "opacity-60",
                  )}
                >
                  {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  hint,
  autoFocus,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="text-alerta"> *</span>}
      </label>
      <input
        type="text"
        value={value}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
      />
      {hint && <p className="mt-1 text-[11px] text-ink-muted/80">{hint}</p>}
    </div>
  );
}
