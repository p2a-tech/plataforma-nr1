import Link from "next/link";
import { CheckCircle2, MessageCircle, Phone, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function Obrigado({
  searchParams,
}: {
  searchParams: { t?: string };
}) {
  const tipo = searchParams.t === "clinica" ? "clinica" : "empresa";
  const ehClinica = tipo === "clinica";

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className={`mb-6 grid h-20 w-20 place-items-center rounded-full ${
          ehClinica
            ? "bg-humano/15 text-humano shadow-glowHuman"
            : "bg-ia/15 text-ia shadow-glow"
        }`}
      >
        <CheckCircle2 className="h-10 w-10" />
      </div>

      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-5xl">
        Recebemos seu pedido.
      </h1>
      <p className="mt-3 max-w-xl text-base text-ink-muted md:text-lg">
        {ehClinica
          ? "Nosso time vai te chamar em até 1 dia útil para entender sua atuação e ativar seu acesso de psicólogo parceiro."
          : "Nosso time vai te chamar em até 1 dia útil para agendar a demonstração de 20 minutos."}
      </p>

      <div className="mt-10 grid w-full max-w-2xl gap-3 md:grid-cols-2">
        <div className="panel p-5 text-left">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink">
            <MessageCircle className="h-4 w-4 text-ia" />
            Próximo passo
          </div>
          <p className="text-sm text-ink-muted">
            Fique de olho no WhatsApp e e-mail que você informou. Mandaremos
            também um e-mail com material da plataforma.
          </p>
        </div>
        <div className="panel p-5 text-left">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink">
            <Phone className="h-4 w-4 text-humano" />
            Urgência?
          </div>
          <p className="text-sm text-ink-muted">
            Se for um caso de fiscalização iminente, escreva para{" "}
            <a className="underline" href="mailto:contato@p2a.tech">
              contato@p2a.tech
            </a>{" "}
            com a palavra <strong>URGENTE</strong> no assunto.
          </p>
        </div>
      </div>

      <Link
        href="/nr1"
        className="mt-10 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        ← Voltar para a página inicial
      </Link>

      <div className="mt-12 flex items-center gap-2 text-xs text-ink-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-ok" />
        Seus dados estão protegidos · LGPD · DPO dpo@p2a.tech
      </div>
    </div>
  );
}
