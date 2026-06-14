"use client";

import { useState } from "react";
import { Plus, X, Check, Loader2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/primitives";

/**
 * Modal para criar uma nova campanha DRPS.
 *
 * Onda 5 · Dev B · §8. POST /api/drps/campanha → retorna token público. Após
 * criar, mostra link copiável de `/r/drps/<token>` (mobile-first; pra
 * compartilhar via WhatsApp/email).
 *
 * Convenção de ciclo (documentada inline pro SST): use ano-PRIMEIRO para
 * ordenação lexicográfica correta — "q1-2026", "2026-mar", "h1-2026".
 */
export function NovaCampanhaButton() {
  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<{
    titulo: string;
    token: string;
    ciclo: string;
  } | null>(null);

  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [ciclo, setCiclo] = useState("");
  const [expiraEm, setExpiraEm] = useState("");

  function fechar() {
    setAberto(false);
    setCriando(false);
    setErro(null);
    setCriada(null);
    setCodigo("");
    setTitulo("");
    setCiclo("");
    setExpiraEm("");
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (criando) return;
    setCriando(true);
    setErro(null);

    const body: Record<string, unknown> = {
      codigo: codigo.trim(),
      titulo: titulo.trim(),
      ciclo: ciclo.trim(),
    };
    if (expiraEm) {
      // input date → ISO meia-noite UTC
      body.expira_em = new Date(`${expiraEm}T23:59:59Z`).toISOString();
    }

    try {
      const r = await fetch("/api/drps/campanha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        setErro(json?.erro ?? "falha_criar");
        setCriando(false);
        return;
      }
      setCriada({
        titulo: json.campanha.titulo,
        token: json.campanha.token,
        ciclo: json.campanha.ciclo,
      });
      setCriando(false);
      // Recarrega depois — usuário ainda quer ver/copiar o link.
    } catch {
      setErro("erro_rede");
      setCriando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-ia/15 px-3 py-1.5 text-xs font-medium text-ia ring-1 ring-inset ring-ia/25 transition hover:bg-ia/25"
      >
        <Plus className="h-3.5 w-3.5" />
        Nova campanha
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-line/15 bg-navy-deep p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-ink">
                Nova campanha DRPS
              </h2>
              <button
                type="button"
                onClick={fechar}
                className="rounded-md p-1 text-ink-muted hover:bg-fill/10 hover:text-ink"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {criada ? (
              <CampanhaCriada
                titulo={criada.titulo}
                token={criada.token}
                ciclo={criada.ciclo}
                onFechar={() => {
                  // Força refresh da página pra mostrar a nova campanha na lista.
                  if (typeof window !== "undefined") window.location.reload();
                }}
              />
            ) : (
              <form onSubmit={submeter} className="space-y-3">
                <Field label="Título (visível no link público)">
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex.: DRPS Q1 2026"
                    className="w-full rounded-md border border-line/15 bg-navy-deep px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-ia/40 focus:outline-none"
                  />
                </Field>
                <Field
                  label="Código (interno)"
                  hint="Letras/números/hífen. Único por empresa."
                >
                  <input
                    type="text"
                    required
                    pattern="[a-zA-Z0-9_-]{2,40}"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="ex.: q1-2026"
                    className="w-full rounded-md border border-line/15 bg-navy-deep px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-ia/40 focus:outline-none"
                  />
                </Field>
                <Field
                  label="Ciclo (chave do comparativo histórico)"
                  hint="Use ano-PRIMEIRO p/ ordenação correta: q1-2026 · 2026-mar · h1-2026."
                >
                  <input
                    type="text"
                    required
                    pattern="[a-zA-Z0-9_-]{2,40}"
                    value={ciclo}
                    onChange={(e) => setCiclo(e.target.value)}
                    placeholder="ex.: q1-2026"
                    className="w-full rounded-md border border-line/15 bg-navy-deep px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-ia/40 focus:outline-none"
                  />
                </Field>
                <Field label="Expira em (opcional)">
                  <input
                    type="date"
                    value={expiraEm}
                    onChange={(e) => setExpiraEm(e.target.value)}
                    className="w-full rounded-md border border-line/15 bg-navy-deep px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-ia/40 focus:outline-none"
                  />
                </Field>

                {erro && (
                  <div className="rounded-md bg-alerta/10 px-3 py-2 text-xs text-alerta ring-1 ring-inset ring-alerta/25">
                    {erro === "codigo_duplicado"
                      ? "Já existe uma campanha com esse código nesta empresa."
                      : erro === "schema_invalido"
                        ? "Preencha os campos no formato esperado."
                        : `Falha: ${erro}`}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={fechar}
                    className="rounded-md bg-fill/10 px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-fill/20"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={criando}
                    className="inline-flex items-center gap-1.5 rounded-md bg-ia/20 px-3 py-1.5 text-xs font-medium text-ia ring-1 ring-inset ring-ia/30 transition hover:bg-ia/30 disabled:opacity-60"
                  >
                    {criando ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Criando…
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" /> Criar campanha
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink/85">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span>
      )}
    </label>
  );
}

function CampanhaCriada({
  titulo,
  token,
  ciclo,
  onFechar,
}: {
  titulo: string;
  token: string;
  ciclo: string;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/drps/${token}`
      : `/r/drps/${token}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* fallback silencioso */
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-ok/10 px-3 py-2 text-xs text-ok ring-1 ring-inset ring-ok/25">
        Campanha criada com sucesso.
      </div>
      <div>
        <div className="text-xs font-medium text-ink-muted">Título</div>
        <div className="mt-0.5 text-sm font-semibold text-ink">{titulo}</div>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone="ia">ciclo: {ciclo}</Badge>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-ink-muted">
          Link público (compartilhe por WhatsApp/email)
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-fill/10 px-2 py-1.5 text-[11px] text-ink-muted">
            {url}
          </code>
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-1.5 rounded-md bg-ia/15 px-2.5 py-1.5 text-xs font-medium text-ia ring-1 ring-inset ring-ia/25 transition hover:bg-ia/25"
          >
            {copiado ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </>
            )}
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onFechar}
          className="rounded-md bg-fill/10 px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-fill/20"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
