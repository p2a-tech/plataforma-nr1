"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";

/**
 * Formulário de captura de leads da landing /nr1.
 * Dois modos: 'empresa' (default) e 'clinica' — adapta campos e copy.
 * Captura UTM/fbclid/gclid silenciosamente do query string.
 */

type Tipo = "empresa" | "clinica";

interface Props {
  tipoInicial?: Tipo;
  id?: string;
  origemAncora?: string;
}

interface AtribuicaoUTM {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  referer?: string;
}

export function LeadForm({ tipoInicial = "empresa", id = "form" }: Props) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [atribuicao, setAtribuicao] = useState<AtribuicaoUTM>({});

  // Captura UTMs/click IDs do query string ao montar
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const get = (k: string) => sp.get(k) ?? undefined;
    setAtribuicao({
      utm_source: get("utm_source"),
      utm_medium: get("utm_medium"),
      utm_campaign: get("utm_campaign"),
      utm_content: get("utm_content"),
      utm_term: get("utm_term"),
      fbclid: get("fbclid"),
      gclid: get("gclid"),
      referer: document.referrer || undefined,
    });
  }, []);

  const labels = useMemo(
    () =>
      tipo === "empresa"
        ? {
            titulo: "Receba uma demonstração em 20 minutos.",
            sub: "Conversa direta com nosso time — sem compromisso, sem comercial agressivo.",
            cta: "Quero ver a demonstração",
            empresa_label: "Empresa",
            empresa_ph: "Ex: Acme Industries",
            cargo_label: "Cargo",
            cargo_ph: "Ex: Diretora de RH",
            extra_label: "Quantos colaboradores?",
            extra_ph: "Ex: 250",
          }
        : {
            titulo: "Vire psicólogo parceiro da PrevIA.",
            sub: "Receba pacientes já triados pela IA, com transcrição e contexto. Sem CAC, sem atendimento administrativo.",
            cta: "Quero ser parceiro",
            empresa_label: "Clínica / consultório",
            empresa_ph: "Opcional",
            cargo_label: "Atuação principal",
            cargo_ph: "Ex: Psicologia organizacional",
            extra_label: "CRP",
            extra_ph: "Ex: 06/12345",
          },
    [tipo],
  );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      tipo,
      nome: String(fd.get("nome") ?? ""),
      email: String(fd.get("email") ?? ""),
      telefone: String(fd.get("telefone") ?? ""),
      empresa_nome: String(fd.get("empresa_nome") ?? ""),
      cargo: String(fd.get("cargo") ?? ""),
      mensagem: String(fd.get("mensagem") ?? ""),
      consentimento_lgpd: fd.get("consentimento_lgpd") === "on",
      ...atribuicao,
    };
    const extra = String(fd.get("extra") ?? "").trim();
    if (extra) {
      if (tipo === "empresa") {
        const n = Number(extra.replace(/[^\d]/g, ""));
        if (Number.isFinite(n) && n > 0) payload.colaboradores = n;
      } else {
        payload.conselho = extra;
      }
    }

    try {
      const res = await fetch("/api/lp-lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErro(
          j?.erro === "consentimento_obrigatorio"
            ? "Para continuar, marque o consentimento LGPD."
            : j?.erro === "validacao"
              ? "Verifique os campos preenchidos."
              : "Algo deu errado. Tente novamente em instantes.",
        );
        setEnviando(false);
        return;
      }
      router.push(`/nr1/obrigado?t=${tipo}`);
    } catch {
      setErro("Sem conexão. Verifique sua internet e tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <div id={id} className="panel mx-auto w-full max-w-2xl p-7 md:p-9">
      {/* Tabs tipo */}
      <div className="mb-6 inline-flex rounded-full border border-line/15 bg-fill/5 p-1">
        <button
          type="button"
          onClick={() => setTipo("empresa")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tipo === "empresa"
              ? "bg-ia text-onaccent shadow-glow"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Sou empresa
        </button>
        <button
          type="button"
          onClick={() => setTipo("clinica")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tipo === "clinica"
              ? "bg-humano text-onaccent shadow-glowHuman"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Sou psicólogo / clínica
        </button>
      </div>

      <h3 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
        {labels.titulo}
      </h3>
      <p className="mt-2 text-sm text-ink-muted">{labels.sub}</p>

      <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Campo label="Nome completo" name="nome" required placeholder="Maria Silva" />
        <Campo label="E-mail corporativo" name="email" type="email" required placeholder="maria@empresa.com.br" />
        <Campo label="WhatsApp" name="telefone" required placeholder="(11) 9 9999-9999" />
        <Campo label={labels.cargo_label} name="cargo" placeholder={labels.cargo_ph} />
        <Campo
          label={labels.empresa_label}
          name="empresa_nome"
          placeholder={labels.empresa_ph}
          className="md:col-span-1"
        />
        <Campo
          label={labels.extra_label}
          name="extra"
          placeholder={labels.extra_ph}
          inputMode={tipo === "empresa" ? "numeric" : undefined}
          className="md:col-span-1"
        />
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">
            Mensagem (opcional)
          </label>
          <textarea
            name="mensagem"
            rows={3}
            placeholder={
              tipo === "empresa"
                ? "Conte rapidinho seu cenário (ex: precisamos do PGR psicossocial pra auditoria)."
                : "Conte sua área de atuação e disponibilidade semanal."
            }
            className="w-full rounded-xl border border-line/15 bg-fill/5 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/70 focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
          />
        </div>

        {/* Consent LGPD */}
        <label className="md:col-span-2 flex cursor-pointer items-start gap-2.5 rounded-xl border border-line/10 bg-fill/5 p-3.5">
          <input
            type="checkbox"
            name="consentimento_lgpd"
            required
            className="mt-0.5 h-4 w-4 cursor-pointer accent-ia"
          />
          <span className="text-xs leading-relaxed text-ink-muted">
            <Lock className="-mt-0.5 mr-1 inline h-3.5 w-3.5 text-ia" />
            Autorizo a <strong className="text-ink">P2A Tech</strong> a entrar em
            contato pelos canais informados. Posso pedir exclusão dos meus dados a
            qualquer momento pelo <strong className="text-ink">DPO</strong> ·{" "}
            <a className="underline hover:text-ink" href="mailto:dpo@p2a.tech">
              dpo@p2a.tech
            </a>
            . Tratamento conforme <strong className="text-ink">LGPD (Art. 7º, I)</strong>.
          </span>
        </label>

        {erro && (
          <div className="md:col-span-2 rounded-xl border border-alerta/40 bg-alerta/10 px-3.5 py-2.5 text-sm text-alerta">
            {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          className={`md:col-span-2 group inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition ${
            tipo === "empresa"
              ? "bg-ia text-onaccent hover:brightness-110 shadow-glow"
              : "bg-humano text-onaccent hover:brightness-110 shadow-glowHuman"
          } ${enviando ? "opacity-75" : ""}`}
        >
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
            </>
          ) : (
            <>
              {labels.cta}{" "}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        <div className="md:col-span-2 mt-1 flex items-center justify-center gap-2 text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-ok" />
          Seus dados não vão pra lista de spam. Resposta em até 1 dia útil.
        </div>
      </form>
    </div>
  );
}

function Campo({
  label,
  name,
  type = "text",
  placeholder,
  required,
  className,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label} {required && <span className="text-alerta">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xl border border-line/15 bg-fill/5 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/70 focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
      />
    </div>
  );
}
