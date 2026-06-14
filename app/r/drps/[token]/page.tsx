import { notFound } from "next/navigation";
import {
  resolverEmpresaPorToken,
  carregarTemplateOkebambo,
  type Pergunta,
} from "@/lib/drps";
import { FormularioDRPS } from "./formulario";

export const dynamic = "force-dynamic";

/**
 * Página pública (sem auth) da campanha DRPS.
 *
 *   /r/drps/[token]
 *
 * O `token` resolve para uma empresa (determinístico via HMAC ou atalho demo).
 * Carregamos o template global Okêbambo e renderizamos o formulário. O cliente
 * envia para `/api/drps/responder` no submit.
 *
 * Mobile-first (WhatsApp deep-link). Sem coleta de PII.
 */
export default async function DRPSPublicaPage({
  params,
}: {
  params: { token: string };
}) {
  const empresaId = await resolverEmpresaPorToken(params.token);
  if (!empresaId) notFound();

  const carregado = await carregarTemplateOkebambo();
  if (!carregado) notFound();
  const { instrumento, perguntas } = carregado;

  return (
    <main className="min-h-screen bg-navy-deep text-ink">
      <div className="mx-auto max-w-xl px-4 py-8">
        <header className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {instrumento.titulo}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Suas respostas são <strong>anônimas</strong>. Não pedimos nome,
            e-mail ou CPF. Leva ~5 minutos.
          </p>
        </header>

        <FormularioDRPS
          token={params.token}
          instrumentoId={instrumento.id}
          perguntas={perguntas as Pergunta[]}
        />

        <footer className="mt-8 text-center text-[11px] text-ink-muted">
          PrevIA · NR-1 · captura anônima por construção. Nenhuma resposta
          individual é exibida — apenas agregados por setor e dimensão.
        </footer>
      </div>
    </main>
  );
}
