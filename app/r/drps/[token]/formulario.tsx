"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { Pergunta, TipoPergunta } from "@/lib/drps";

/**
 * Tipo da sugestão de cargo retornada por GET /api/catalogo/papeis
 * (definido localmente para evitar importar `server-only` no client).
 */
interface SugestaoCargo {
  id: string;
  nome: string;
  area: string;
  conselho_profissional?: string;
}

/**
 * Formulário público mobile-first do DRPS.
 *
 * Renderiza cada pergunta conforme seu `tipo`:
 *   - demografia        → <select> com opções (ou texto livre)
 *   - likert5_inverso   → radio 1-5 (Sempre…Nunca)
 *   - likert3_freq      → radio 1-3 (Raramente…Frequentemente)
 *   - impacto4          → radio 1-4 (Não…Significativamente)
 *   - esgotamento5      → radio 1-5 (Nunca…Sempre)
 *   - multi_choice      → checkboxes (várias opções) + texto livre opcional
 *   - texto             → textarea
 *
 * Marcador anônimo: gerado client-side com `crypto.randomUUID()` + persistido
 * em localStorage por token → permite o usuário continuar de onde parou em re-
 * acessos do mesmo dispositivo. Não é PII (não vincula a pessoa).
 */

type ValorPergunta = {
  valor_int?: number | null;
  valor_texto?: string | null;
  opcoes_ids?: string[];
};

const LIKERT5_INV_LABELS = ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"];
// Mapeamento: "Sempre"=1 ... "Nunca"=5 (inverso). UI mostra do pior pro melhor.
const LIKERT5_INV: { valor: number; label: string }[] = [
  { valor: 1, label: "Sempre" },
  { valor: 2, label: "Frequentemente" },
  { valor: 3, label: "Às vezes" },
  { valor: 4, label: "Raramente" },
  { valor: 5, label: "Nunca" },
];

const LIKERT3: { valor: number; label: string }[] = [
  { valor: 1, label: "Raramente" },
  { valor: 2, label: "Às vezes" },
  { valor: 3, label: "Frequentemente" },
];

const IMPACTO4: { valor: number; label: string }[] = [
  { valor: 1, label: "Não" },
  { valor: 2, label: "Levemente" },
  { valor: 3, label: "Moderadamente" },
  { valor: 4, label: "Significativamente" },
];

const ESGOTAMENTO5: { valor: number; label: string }[] = [
  { valor: 1, label: "Nunca" },
  { valor: 2, label: "Raramente" },
  { valor: 3, label: "Às vezes" },
  { valor: 4, label: "Frequentemente" },
  { valor: 5, label: "Sempre" },
];

function marcadorParaToken(token: string): string {
  if (typeof window === "undefined") return "";
  const k = `previa:drps:marcador:${token}`;
  let m = localStorage.getItem(k);
  if (!m) {
    // randomUUID já é forte; trunca pra caber em 32 chars do marcador.
    const u =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    m = u.replace(/-/g, "").slice(0, 32);
    localStorage.setItem(k, m);
  }
  return m;
}

export function FormularioDRPS({
  token,
  instrumentoId,
  perguntas,
}: {
  token: string;
  instrumentoId: string;
  perguntas: Pergunta[];
}) {
  const ordenadas = useMemo(
    () => [...perguntas].sort((a, b) => a.ordem - b.ordem),
    [perguntas],
  );

  const [valores, setValores] = useState<Record<string, ValorPergunta>>({});
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function set(codigo: string, v: Partial<ValorPergunta>) {
    setValores((prev) => ({ ...prev, [codigo]: { ...prev[codigo], ...v } }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    // Mapeia para o payload aceito pelo Zod do server.
    const respostas = Object.entries(valores)
      .map(([codigo, v]) => ({
        pergunta_codigo: codigo,
        valor_int: v.valor_int ?? null,
        valor_texto: v.valor_texto ?? null,
        opcoes_ids: v.opcoes_ids ?? [],
      }))
      .filter(
        (r) =>
          r.valor_int != null ||
          (r.valor_texto && r.valor_texto.trim().length > 0) ||
          (r.opcoes_ids && r.opcoes_ids.length > 0),
      );

    if (respostas.length === 0) {
      setErro("Responda ao menos uma pergunta antes de enviar.");
      return;
    }

    // Demografia para denormalização (filtros em /escuta/drps)
    const demografia = {
      setor: (valores["Q1"]?.valor_texto || null) ?? null,
      funcao: (valores["Q2"]?.valor_texto || null) ?? null,
      tempo_empresa: (valores["Q3"]?.valor_texto || null) ?? null,
      forma_atuacao: (valores["Q4"]?.valor_texto || null) ?? null,
    };

    setEnviando(true);
    try {
      const r = await fetch("/api/drps/responder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          instrumento_id: instrumentoId,
          payload: {
            marcador_anonimo: marcadorParaToken(token),
            ...demografia,
            canal: "web",
            respostas,
          },
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.erro ?? `erro_${r.status}`);
      }
      setSucesso(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "falha_envio";
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="rounded-2xl border border-ok/25 bg-ok/[0.06] p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-ok" />
        <h2 className="mt-3 text-lg font-semibold text-ink">
          Resposta registrada
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Obrigado por participar. Suas respostas vão alimentar o diagnóstico
          NR-1 da clínica de forma anônima.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {ordenadas.map((p) => (
        <PerguntaCampo
          key={p.id}
          pergunta={p}
          valor={valores[p.codigo] ?? {}}
          onChange={(v) => set(p.codigo, v)}
        />
      ))}

      {erro && (
        <div className="flex items-center gap-2 rounded-lg border border-alerta/25 bg-alerta/[0.06] px-3 py-2 text-sm text-alerta">
          <AlertCircle className="h-4 w-4" /> {erro}
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-ia px-4 py-3 text-sm font-semibold text-onaccent shadow-lg shadow-ia/20 transition hover:bg-ia/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
          </>
        ) : (
          <>Enviar respostas</>
        )}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-ink-muted">
        Ao enviar, você concorda em compartilhar respostas anônimas com a equipe
        SST da empresa para o diagnóstico NR-1.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
function PerguntaCampo({
  pergunta,
  valor,
  onChange,
}: {
  pergunta: Pergunta;
  valor: ValorPergunta;
  onChange: (v: Partial<ValorPergunta>) => void;
}) {
  const t: TipoPergunta = pergunta.tipo;

  return (
    <div className="rounded-2xl border border-line/10 bg-fill/5 p-4">
      <label className="block text-sm font-medium text-ink">
        <span className="mr-2 text-ink-muted">{pergunta.codigo}.</span>
        {pergunta.enunciado}
      </label>

      <div className="mt-3">
        {t === "demografia" && (
          <DemografiaCampo
            pergunta={pergunta}
            valor={valor}
            onChange={onChange}
          />
        )}
        {t === "likert5_inverso" && (
          <EscalaRadio
            codigo={pergunta.codigo}
            opcoes={LIKERT5_INV}
            valor={valor.valor_int ?? null}
            onChange={(n) => onChange({ valor_int: n })}
          />
        )}
        {t === "likert3_freq" && (
          <EscalaRadio
            codigo={pergunta.codigo}
            opcoes={LIKERT3}
            valor={valor.valor_int ?? null}
            onChange={(n) => onChange({ valor_int: n })}
          />
        )}
        {t === "impacto4" && (
          <EscalaRadio
            codigo={pergunta.codigo}
            opcoes={IMPACTO4}
            valor={valor.valor_int ?? null}
            onChange={(n) => onChange({ valor_int: n })}
          />
        )}
        {t === "esgotamento5" && (
          <EscalaRadio
            codigo={pergunta.codigo}
            opcoes={ESGOTAMENTO5}
            valor={valor.valor_int ?? null}
            onChange={(n) => onChange({ valor_int: n })}
          />
        )}
        {t === "multi_choice" && (
          <MultiChoiceCampo
            pergunta={pergunta}
            valor={valor}
            onChange={onChange}
          />
        )}
        {t === "texto" && (
          <textarea
            className="block w-full rounded-md border border-line/10 bg-navy-panel px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70"
            placeholder="Escreva aqui (opcional)…"
            rows={4}
            value={valor.valor_texto ?? ""}
            onChange={(e) => onChange({ valor_texto: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}

function DemografiaCampo({
  pergunta,
  valor,
  onChange,
}: {
  pergunta: Pergunta;
  valor: ValorPergunta;
  onChange: (v: Partial<ValorPergunta>) => void;
}) {
  const tem = pergunta.opcoes.length > 0;
  if (tem) {
    return (
      <select
        className="block w-full rounded-md border border-line/10 bg-navy-panel px-3 py-2 text-sm text-ink"
        value={valor.valor_texto ?? ""}
        onChange={(e) => onChange({ valor_texto: e.target.value })}
      >
        <option value="">Selecione…</option>
        {pergunta.opcoes.map((o) => (
          <option key={o.id} value={o.label}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  // Q2 (função/cargo) usa autocomplete com /api/catalogo/papeis. Demais
  // demografias sem opções caem em <input> simples.
  if (pergunta.codigo === "Q2") {
    return (
      <AutocompletePapel
        valor={valor.valor_texto ?? ""}
        onChange={(v) => onChange({ valor_texto: v })}
      />
    );
  }

  return (
    <input
      type="text"
      className="block w-full rounded-md border border-line/10 bg-navy-panel px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70"
      placeholder="Sua resposta"
      value={valor.valor_texto ?? ""}
      onChange={(e) => onChange({ valor_texto: e.target.value })}
    />
  );
}

/**
 * Autocomplete da Q2 (cargo). Chama GET /api/catalogo/papeis?q=... com debounce
 * curto. Mantém "Outro" como fallback (texto livre) — o usuário pode digitar
 * livremente sem precisar selecionar nenhuma sugestão.
 */
function AutocompletePapel({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (v: string) => void;
}) {
  const [sugestoes, setSugestoes] = useState<SugestaoCargo[]>([]);
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!foco) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const url =
          "/api/catalogo/papeis" +
          (valor ? `?q=${encodeURIComponent(valor)}` : "");
        const r = await fetch(url);
        if (!r.ok) return;
        const data = (await r.json()) as { cargos: SugestaoCargo[] };
        setSugestoes(data.cargos ?? []);
        setAberto(true);
      } catch {
        // Falha de rede — silencioso; user mantém texto livre.
      }
    }, 180);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [valor, foco]);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        className="block w-full rounded-md border border-line/10 bg-navy-panel px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70"
        placeholder="Ex.: Psicologia, Atendente, Outro…"
        value={valor}
        onFocus={() => setFoco(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        autoComplete="off"
      />
      {aberto && sugestoes.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line/10 bg-navy-panel shadow-lg shadow-black/30"
        >
          {sugestoes.map((s) => (
            <li
              key={s.id}
              role="option"
              aria-selected={s.nome === valor}
              className="cursor-pointer px-3 py-2 text-sm text-ink hover:bg-fill/10"
              onMouseDown={(e) => {
                // mousedown (em vez de click) para não perder foco antes.
                e.preventDefault();
                onChange(s.nome);
                setAberto(false);
              }}
            >
              <span>{s.nome}</span>
              {s.conselho_profissional && (
                <span className="ml-2 text-[11px] text-ink-muted">
                  · {s.conselho_profissional}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-ink-muted">
        Use a lista ou digite seu cargo (incluindo &quot;Outro&quot;).
      </p>
    </div>
  );
}

function EscalaRadio({
  codigo,
  opcoes,
  valor,
  onChange,
}: {
  codigo: string;
  opcoes: { valor: number; label: string }[];
  valor: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {opcoes.map((o) => {
        const id = `${codigo}_${o.valor}`;
        const sel = valor === o.valor;
        return (
          <label
            key={o.valor}
            htmlFor={id}
            className={
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition " +
              (sel
                ? "border-ia/50 bg-ia/15 text-ink"
                : "border-line/10 bg-navy-panel text-ink/85 hover:bg-fill/10")
            }
          >
            <input
              id={id}
              type="radio"
              name={codigo}
              checked={sel}
              onChange={() => onChange(o.valor)}
              className="accent-ia"
            />
            <span>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function MultiChoiceCampo({
  pergunta,
  valor,
  onChange,
}: {
  pergunta: Pergunta;
  valor: ValorPergunta;
  onChange: (v: Partial<ValorPergunta>) => void;
}) {
  const selecionadas = new Set(valor.opcoes_ids ?? []);
  function toggle(id: string) {
    const nova = new Set(selecionadas);
    if (nova.has(id)) nova.delete(id);
    else nova.add(id);
    onChange({ opcoes_ids: Array.from(nova) });
  }
  return (
    <div className="flex flex-col gap-2">
      {pergunta.opcoes.map((o) => {
        const sel = selecionadas.has(o.id);
        return (
          <label
            key={o.id}
            className={
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition " +
              (sel
                ? "border-ia/50 bg-ia/15 text-ink"
                : "border-line/10 bg-navy-panel text-ink/85 hover:bg-fill/10")
            }
          >
            <input
              type="checkbox"
              checked={sel}
              onChange={() => toggle(o.id)}
              className="accent-ia"
            />
            <span>{o.label}</span>
          </label>
        );
      })}
      <input
        type="text"
        placeholder="Outro / observação (opcional)"
        className="mt-1 block w-full rounded-md border border-line/10 bg-navy-panel px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70"
        value={valor.valor_texto ?? ""}
        onChange={(e) => onChange({ valor_texto: e.target.value })}
      />
    </div>
  );
}
