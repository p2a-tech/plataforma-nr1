"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Loader2,
  X,
  RefreshCw,
  Copy,
  Check,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmpresaOpcao {
  id: string;
  nome: string;
}
export interface ClinicaOpcao {
  id: string;
  nome: string;
  empresa_id: string;
}

type Papel = "sst" | "clinica" | "admin";

const PAPEL_OPCOES: { value: Papel; label: string }[] = [
  { value: "sst", label: "Gestor SST" },
  { value: "clinica", label: "Clínica" },
  { value: "admin", label: "Admin P2A" },
];

function gerarSenha(tamanho = 14): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const cripto = typeof crypto !== "undefined" ? crypto : undefined;
  if (cripto?.getRandomValues) {
    const buf = new Uint32Array(tamanho);
    cripto.getRandomValues(buf);
    for (let i = 0; i < tamanho; i++) s += alfabeto[buf[i] % alfabeto.length];
  } else {
    for (let i = 0; i < tamanho; i++) s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return s;
}

/**
 * Botão "Novo usuário" + modal de cadastro. POST /api/admin/usuarios.
 * Ao criar, exibe a senha temporária UMA vez para o admin copiar.
 */
export function NovoUsuario({
  empresas,
  clinicas,
  empresaPadrao,
}: {
  empresas: EmpresaOpcao[];
  clinicas: ClinicaOpcao[];
  empresaPadrao?: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<Papel>("sst");
  const [empresaId, setEmpresaId] = useState(empresaPadrao ?? empresas[0]?.id ?? "");
  const [clinicaId, setClinicaId] = useState("");
  const [senha, setSenha] = useState(gerarSenha());

  // Resultado da criação (senha temporária para copiar).
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Clínicas filtradas pela empresa selecionada.
  const clinicasDaEmpresa = useMemo(
    () => clinicas.filter((c) => c.empresa_id === empresaId),
    [clinicas, empresaId],
  );

  function reset() {
    setEmail("");
    setNome("");
    setPapel("sst");
    setEmpresaId(empresaPadrao ?? empresas[0]?.id ?? "");
    setClinicaId("");
    setSenha(gerarSenha());
    setErro(null);
    setCriado(null);
    setCopiado(false);
  }

  function fechar() {
    if (salvando) return;
    setAberto(false);
    // Mantém estado de "criado" limpo ao reabrir.
    if (criado) {
      reset();
      router.refresh();
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!email.trim() || !nome.trim()) {
      setErro("Preencha e-mail e nome.");
      return;
    }
    if (!empresaId) {
      setErro("Selecione a empresa.");
      return;
    }
    if (papel === "clinica" && !clinicaId) {
      setErro("Para papel Clínica, selecione a clínica.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          nome: nome.trim(),
          papel,
          empresa_id: empresaId,
          clinica_id: papel === "clinica" ? clinicaId : undefined,
          senhaTemporaria: senha,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(traduzErro(data?.erro) ?? data?.detalhe?.[0] ?? "Falha ao criar usuário.");
        return;
      }
      setCriado({ email: data.usuario.email, senha: data.senhaTemporaria });
      router.refresh();
    } catch {
      setErro("Sem conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function copiar() {
    if (!criado) return;
    try {
      await navigator.clipboard.writeText(`${criado.email} / ${criado.senha}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard pode falhar em http; admin copia manual */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-ia px-4 py-2 text-sm font-semibold text-onaccent shadow-glow hover:brightness-110"
      >
        <UserPlus className="h-4 w-4" /> Novo usuário
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="novo-usuario-titulo"
          onClick={(e) => {
            if (e.target === e.currentTarget) fechar();
          }}
        >
          <div className="panel w-full max-w-lg p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <UserPlus className="h-5 w-5 text-ia" />
                <h2 id="novo-usuario-titulo" className="font-display text-lg font-semibold text-ink">
                  {criado ? "Usuário criado" : "Novo usuário"}
                </h2>
              </div>
              <button
                type="button"
                onClick={fechar}
                className="text-ink-muted hover:text-ink"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {criado ? (
              <div className="space-y-4">
                <p className="text-sm text-ink/80">
                  Repasse estas credenciais ao usuário com segurança. A senha
                  temporária <span className="font-medium text-ink">não será exibida novamente</span>.
                </p>
                <div className="rounded-xl border border-ia/20 bg-ia/[0.04] p-4">
                  <div className="text-xs text-ink-muted">E-mail</div>
                  <div className="font-mono text-sm text-ink">{criado.email}</div>
                  <div className="mt-3 text-xs text-ink-muted">Senha temporária</div>
                  <div className="flex items-center gap-2">
                    <code className="select-all rounded-lg bg-fill/10 px-2 py-1 font-mono text-sm text-ink">
                      {criado.senha}
                    </code>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={copiar}
                    className="inline-flex items-center gap-2 rounded-xl border border-line/15 px-4 py-2 text-sm text-ink hover:bg-fill/10"
                  >
                    {copiado ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    type="button"
                    onClick={fechar}
                    className="rounded-xl bg-ia px-4 py-2 text-sm font-semibold text-onaccent shadow-glow hover:brightness-110"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Nome" value={nome} onChange={setNome} placeholder="Nome completo" required />
                  <Campo
                    label="E-mail"
                    value={email}
                    onChange={setEmail}
                    placeholder="pessoa@empresa.com"
                    type="email"
                    required
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="u-papel" className="mb-1.5 block text-xs font-medium text-ink-muted">
                      Papel <span className="text-alerta">*</span>
                    </label>
                    <select
                      id="u-papel"
                      value={papel}
                      onChange={(e) => {
                        setPapel(e.target.value as Papel);
                        if (e.target.value !== "clinica") setClinicaId("");
                      }}
                      className="w-full rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
                    >
                      {PAPEL_OPCOES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="u-empresa" className="mb-1.5 block text-xs font-medium text-ink-muted">
                      Empresa <span className="text-alerta">*</span>
                    </label>
                    <select
                      id="u-empresa"
                      value={empresaId}
                      onChange={(e) => {
                        setEmpresaId(e.target.value);
                        setClinicaId("");
                      }}
                      className="w-full rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
                    >
                      {empresas.length === 0 && <option value="">— nenhuma —</option>}
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {papel === "clinica" && (
                  <div>
                    <label htmlFor="u-clinica" className="mb-1.5 block text-xs font-medium text-ink-muted">
                      Clínica <span className="text-alerta">*</span>
                    </label>
                    <select
                      id="u-clinica"
                      value={clinicaId}
                      onChange={(e) => setClinicaId(e.target.value)}
                      className="w-full rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
                    >
                      <option value="">— selecione —</option>
                      {clinicasDaEmpresa.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                    {clinicasDaEmpresa.length === 0 && (
                      <p className="mt-1 text-[11px] text-humano-soft">
                        Esta empresa não tem clínicas cadastradas.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="u-senha" className="mb-1.5 block text-xs font-medium text-ink-muted">
                    Senha temporária <span className="text-alerta">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                      <input
                        id="u-senha"
                        type="text"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        className="w-full rounded-xl border border-line/15 bg-fill/5 py-2 pl-9 pr-3 font-mono text-sm text-ink focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSenha(gerarSenha())}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-line/15 px-3 py-2 text-xs text-ink hover:bg-fill/10"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Gerar
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-muted/80">
                    Mínimo 8 caracteres. O usuário deve trocá-la no primeiro acesso.
                  </p>
                </div>

                {erro && (
                  <p className="text-sm text-alerta" role="alert">
                    {erro}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={fechar}
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
                    Criar usuário
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

function traduzErro(erro?: string): string | null {
  switch (erro) {
    case "email_duplicado":
      return "Já existe um usuário com esse e-mail.";
    case "empresa_inexistente":
      return "Empresa não encontrada.";
    case "clinica_obrigatoria":
      return "Para papel Clínica, a clínica é obrigatória.";
    case "clinica_invalida":
      return "Clínica inválida para a empresa selecionada.";
    case "validacao":
      return "Dados inválidos. Verifique os campos.";
    default:
      return null;
  }
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="text-alerta"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
      />
    </div>
  );
}
