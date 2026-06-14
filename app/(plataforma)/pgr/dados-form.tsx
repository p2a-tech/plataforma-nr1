"use client";

/**
 * Formulário para preencher os dados Okêbambo (Seções 1, 3, 4.1, 4.2 e 9 do PGR).
 *
 * Onda 4 · Backlog §6. Salva via PATCH /api/pgr/[revisao]/dados.
 * Inclui:
 *   - Identificação da empresa (razão social, nome fantasia, CNPJ formatado, endereço)
 *   - Responsável técnico (nome, conselho, registro)
 *   - Atividades (público + descrição com autocomplete do catálogo)
 *   - Riscos físicos e ergonômicos manuais (array editável)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Plus, X, Building2, UserCog, BookOpen, ListChecks } from "lucide-react";
import type { PgrRevisao, RiscoManualPgr } from "@/lib/pgr";
import { ATIVIDADES_CLINICAS, descricaoPadrao } from "@/lib/catalogo-atividades-clinicas";

const CONSELHOS = ["CRP", "CRM", "CREA", "COREN", "CRF", "CRO", "CRESS", "Outro"] as const;
type Conselho = (typeof CONSELHOS)[number] | "";

const TABS = [
  { key: "identificacao", label: "Identificação", icon: Building2 },
  { key: "atividades", label: "Atividades", icon: BookOpen },
  { key: "riscos", label: "Riscos físicos / ergonômicos", icon: ListChecks },
  { key: "responsavel", label: "Responsável técnico", icon: UserCog },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function fmtCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

const CNPJ_RE = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

export function DadosForm({
  revisao,
  inicial,
}: {
  revisao: number;
  inicial: PgrRevisao | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("identificacao");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Identificação
  const [razao, setRazao] = useState(inicial?.razao_social ?? "");
  const [fantasia, setFantasia] = useState(inicial?.nome_fantasia ?? "");
  const [cnpj, setCnpj] = useState(inicial?.cnpj ?? "");
  const [endereco, setEndereco] = useState(inicial?.endereco ?? "");

  // Responsável técnico
  const [rtNome, setRtNome] = useState(inicial?.responsavel_tecnico_nome ?? "");
  const [rtConselho, setRtConselho] = useState<Conselho>(
    (inicial?.responsavel_tecnico_conselho as Conselho) ?? "",
  );
  const [rtRegistro, setRtRegistro] = useState(inicial?.responsavel_tecnico_registro ?? "");

  // Atividades
  const [publico, setPublico] = useState(inicial?.publico_atendido ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao_atividades ?? "");

  // Riscos manuais
  const [riscosFisicos, setRiscosFisicos] = useState<RiscoManualPgr[]>(
    inicial?.riscos_fisicos ?? [],
  );
  const [riscosErgo, setRiscosErgo] = useState<RiscoManualPgr[]>(
    inicial?.riscos_ergonomicos ?? [],
  );

  const addRisco = (tipo: "f" | "e") => {
    const novo: RiscoManualPgr = { risco: "", fonte: "", consequencia: "" };
    if (tipo === "f") setRiscosFisicos([...riscosFisicos, novo]);
    else setRiscosErgo([...riscosErgo, novo]);
  };
  const updRisco = (tipo: "f" | "e", idx: number, campo: keyof RiscoManualPgr, valor: string) => {
    const arr = tipo === "f" ? [...riscosFisicos] : [...riscosErgo];
    arr[idx] = { ...arr[idx], [campo]: valor };
    if (tipo === "f") setRiscosFisicos(arr);
    else setRiscosErgo(arr);
  };
  const rmRisco = (tipo: "f" | "e", idx: number) => {
    if (tipo === "f") setRiscosFisicos(riscosFisicos.filter((_, i) => i !== idx));
    else setRiscosErgo(riscosErgo.filter((_, i) => i !== idx));
  };

  const aplicarTemplateAtividades = (key: string) => {
    const item = ATIVIDADES_CLINICAS.find((a) => a.key === key);
    if (!item) return;
    const txt = descricao.trim() === "" ? item.descricao : `${descricao} ${item.descricao}`;
    setDescricao(txt);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem(null);
    if (cnpj && !CNPJ_RE.test(cnpj)) {
      setMensagem({ tipo: "erro", texto: "CNPJ deve estar no formato 00.000.000/0000-00." });
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch(`/api/pgr/${revisao}/dados`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          razao_social: razao,
          nome_fantasia: fantasia,
          cnpj,
          endereco,
          responsavel_tecnico_nome: rtNome,
          responsavel_tecnico_conselho: rtConselho,
          responsavel_tecnico_registro: rtRegistro,
          publico_atendido: publico,
          descricao_atividades: descricao,
          riscos_fisicos: riscosFisicos.filter((r) => r.risco || r.fonte || r.consequencia),
          riscos_ergonomicos: riscosErgo.filter((r) => r.risco || r.fonte || r.consequencia),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        const detalhe = Array.isArray(j.detalhe) ? `: ${j.detalhe.join(", ")}` : "";
        setMensagem({ tipo: "erro", texto: `${j.erro ?? "Falha ao salvar"}${detalhe}` });
        return;
      }
      setMensagem({ tipo: "ok", texto: "Dados Okêbambo salvos. O hash será recomputado." });
      router.refresh();
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-line/10 bg-fill/[0.02] p-1">
        {TABS.map((t) => {
          const Icone = t.icon;
          const ativo = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                ativo
                  ? "bg-ia/15 text-ia ring-1 ring-inset ring-ia/30"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icone className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das tabs */}
      {tab === "identificacao" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Campo label="Razão social">
            <input
              value={razao}
              onChange={(e) => setRazao(e.target.value)}
              placeholder="Ex.: Okêbambo Saúde e Educação LTDA"
              className={inputCls}
            />
          </Campo>
          <Campo label="Nome fantasia">
            <input
              value={fantasia}
              onChange={(e) => setFantasia(e.target.value)}
              placeholder="Ex.: Okêbambo"
              className={inputCls}
            />
          </Campo>
          <Campo label="CNPJ (00.000.000/0000-00)">
            <input
              value={cnpj}
              onChange={(e) => setCnpj(fmtCnpj(e.target.value))}
              placeholder="54.413.743/0001-12"
              className={inputCls}
              inputMode="numeric"
            />
          </Campo>
          <Campo label="Endereço completo">
            <input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro, cidade, UF, CEP"
              className={inputCls}
            />
          </Campo>
        </div>
      )}

      {tab === "atividades" && (
        <div className="space-y-3">
          <Campo label="Público atendido">
            <input
              value={publico}
              onChange={(e) => setPublico(e.target.value)}
              placeholder="Ex.: crianças, adolescentes, adultos e famílias"
              className={inputCls}
            />
          </Campo>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Sugestões do catálogo clínico
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ATIVIDADES_CLINICAS.map((a) => (
                <button
                  type="button"
                  key={a.key}
                  onClick={() => aplicarTemplateAtividades(a.key)}
                  className="rounded-md border border-line/10 bg-fill/[0.03] px-2 py-1 text-[11px] text-ink-muted hover:text-ia hover:border-ia/30"
                  title={a.descricao}
                >
                  + {a.label}
                </button>
              ))}
            </div>
          </div>

          <Campo label="Descrição das atividades clínicas">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={5}
              placeholder="Descreva as atividades operacionais — atendimentos, avaliações, supervisão, orientações…"
              className={`${inputCls} resize-y`}
            />
          </Campo>
        </div>
      )}

      {tab === "riscos" && (
        <div className="space-y-5">
          <SecaoRiscos
            titulo="4.1 Riscos físicos"
            ajuda="Ex.: ruído, iluminação inadequada, temperatura, fios expostos."
            riscos={riscosFisicos}
            onAdd={() => addRisco("f")}
            onUpd={(i, c, v) => updRisco("f", i, c, v)}
            onRm={(i) => rmRisco("f", i)}
          />
          <SecaoRiscos
            titulo="4.2 Riscos ergonômicos"
            ajuda="Ex.: postura inadequada, permanência prolongada sentado, mobiliário não regulável."
            riscos={riscosErgo}
            onAdd={() => addRisco("e")}
            onUpd={(i, c, v) => updRisco("e", i, c, v)}
            onRm={(i) => rmRisco("e", i)}
          />
        </div>
      )}

      {tab === "responsavel" && (
        <div className="grid gap-3 md:grid-cols-3">
          <Campo label="Nome do responsável técnico" className="md:col-span-3">
            <input
              value={rtNome}
              onChange={(e) => setRtNome(e.target.value)}
              placeholder="Ex.: Marina Alves"
              className={inputCls}
            />
          </Campo>
          <Campo label="Conselho">
            <select
              value={rtConselho}
              onChange={(e) => setRtConselho(e.target.value as Conselho)}
              className={inputCls}
            >
              <option value="" className="bg-navy-panel">
                Selecione…
              </option>
              {CONSELHOS.map((c) => (
                <option key={c} value={c} className="bg-navy-panel">
                  {c}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Registro profissional" className="md:col-span-2">
            <input
              value={rtRegistro}
              onChange={(e) => setRtRegistro(e.target.value)}
              placeholder="Ex.: 12345"
              className={inputCls}
            />
          </Campo>
        </div>
      )}

      {mensagem && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ring-1 ring-inset ${
            mensagem.tipo === "ok"
              ? "bg-ok/10 text-ok ring-ok/25"
              : "bg-alerta/10 text-alerta ring-alerta/25"
          }`}
        >
          {mensagem.texto}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line/10 pt-3">
        <p className="text-[11px] text-ink-muted">
          Cada salvamento recomputa o hash do PGR. Se o conteúdo mudar, a assinatura vigente é
          invalidada e exige nova assinatura humana.
        </p>
        <button
          type="submit"
          disabled={enviando}
          className="flex items-center gap-2 rounded-xl bg-ia px-4 py-2 text-sm font-semibold text-onaccent transition hover:bg-ia/90 disabled:opacity-60"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar rascunho
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-line/10 bg-fill/[0.03] px-3 py-2 text-sm text-ink outline-none focus:border-ia/40";

function Campo({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

function SecaoRiscos({
  titulo,
  ajuda,
  riscos,
  onAdd,
  onUpd,
  onRm,
}: {
  titulo: string;
  ajuda: string;
  riscos: RiscoManualPgr[];
  onAdd: () => void;
  onUpd: (idx: number, campo: keyof RiscoManualPgr, valor: string) => void;
  onRm: (idx: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-ink">{titulo}</div>
          <p className="text-[11px] text-ink-muted">{ajuda}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 rounded-lg bg-ia/10 px-2.5 py-1 text-xs font-medium text-ia ring-1 ring-inset ring-ia/25 hover:bg-ia/20"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>
      {riscos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line/15 bg-fill/[0.02] px-3 py-3 text-center text-[11px] text-ink-muted">
          Nenhum risco listado. Adicione conforme avaliação da clínica.
        </p>
      ) : (
        <div className="space-y-2">
          {riscos.map((r, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border border-line/10 bg-fill/[0.02] p-2.5 md:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <input
                value={r.risco}
                onChange={(e) => onUpd(i, "risco", e.target.value)}
                placeholder="Risco"
                className={inputCls}
              />
              <input
                value={r.fonte}
                onChange={(e) => onUpd(i, "fonte", e.target.value)}
                placeholder="Fonte"
                className={inputCls}
              />
              <input
                value={r.consequencia}
                onChange={(e) => onUpd(i, "consequencia", e.target.value)}
                placeholder="Consequência"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => onRm(i)}
                className="flex h-8 w-8 items-center justify-center self-center rounded-lg bg-alerta/10 text-alerta ring-1 ring-inset ring-alerta/25 hover:bg-alerta/20"
                title="Remover"
                aria-label="Remover risco"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
