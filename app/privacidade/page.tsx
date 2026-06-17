import type { Metadata } from "next";
import Link from "next/link";
import { Brain, ShieldCheck } from "lucide-react";

/**
 * Política de Privacidade — página pública (sem auth).
 * Baseada no que a plataforma realmente faz: leads da landing, escuta DRPS
 * com k-anonimato, encaminhamento clínico sob sigilo, analytics opcional.
 */

export const metadata: Metadata = {
  title: "Política de Privacidade · PrevIA | P2A Tech",
  description:
    "Como a P2A Tech trata seus dados pessoais na plataforma PrevIA e na landing — finalidades, bases legais, cookies, direitos do titular (LGPD) e canal do DPO.",
  robots: { index: true, follow: true },
};

const ATUALIZADO_EM = "17 de junho de 2026";

export default function PoliticaPrivacidade() {
  return (
    <LegalShell titulo="Política de Privacidade" atualizadoEm={ATUALIZADO_EM}>
      <p>
        Esta Política de Privacidade descreve como a <strong>P2A Tech</strong>{" "}
        (&ldquo;P2A&rdquo;, &ldquo;nós&rdquo;) trata dados pessoais na plataforma{" "}
        <strong>PrevIA</strong> e em seu site de divulgação, em conformidade com a
        Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).
      </p>

      <Secao titulo="1. Controlador e Encarregado (DPO)">
        <p>
          O controlador dos dados é a <strong>P2A Tech</strong>. O Encarregado pelo
          Tratamento de Dados Pessoais (DPO) pode ser contatado pelo e-mail{" "}
          <a href="mailto:dpo@p2a.tech">dpo@p2a.tech</a>. Para assuntos gerais:{" "}
          <a href="mailto:contato@p2a.tech">contato@p2a.tech</a>.
        </p>
        <p>
          Quando uma empresa cliente contrata a PrevIA para avaliar seus próprios
          colaboradores, a empresa atua como <strong>controladora</strong> desses
          dados e a P2A atua como <strong>operadora</strong>, tratando os dados
          conforme as instruções da empresa e o contrato firmado.
        </p>
      </Secao>

      <Secao titulo="2. Quais dados coletamos">
        <ul>
          <li>
            <strong>Contato na landing (leads):</strong> nome, e-mail, telefone/WhatsApp,
            empresa ou clínica, cargo/atuação, número de colaboradores ou registro
            profissional (ex.: CRP) e a mensagem que você enviar.
          </li>
          <li>
            <strong>Dados de atribuição de marketing:</strong> parâmetros de campanha
            (UTM), identificadores de clique (fbclid, gclid) e a página de origem
            (referer), quando presentes na URL de acesso.
          </li>
          <li>
            <strong>Dados de uso da plataforma:</strong> credenciais de acesso, registros
            de autenticação e trilhas de auditoria de acesso, necessários à segurança.
          </li>
          <li>
            <strong>Respostas da escuta ativa (DRPS):</strong> respostas ao instrumento de
            avaliação de riscos psicossociais, tratadas de forma{" "}
            <strong>agregada e com k-anonimato mínimo de 7 pessoas</strong> — ou seja,
            nenhum indivíduo é identificável nos painéis e relatórios da empresa.
          </li>
          <li>
            <strong>Cookies e tecnologias similares:</strong> cookies essenciais e, mediante
            seu consentimento, cookies de análise (veja a seção 6).
          </li>
        </ul>
      </Secao>

      <Secao titulo="3. Finalidades do tratamento">
        <ul>
          <li>Responder a solicitações de contato e demonstração feitas na landing.</li>
          <li>Prestar o serviço contratado: escuta ativa, geração de PGR psicossocial e relatórios de conformidade com a NR-1.</li>
          <li>Encaminhar, quando indicado, casos individuais a clínicas e profissionais parceiros, sob sigilo profissional (NR-7).</li>
          <li>Garantir segurança, prevenir fraudes e manter trilhas de auditoria.</li>
          <li>Cumprir obrigações legais e regulatórias (ex.: eSocial S-2240).</li>
          <li>Medir e melhorar o site e as campanhas, quando você consente com cookies de análise.</li>
        </ul>
      </Secao>

      <Secao titulo="4. Bases legais">
        <p>O tratamento se apoia, conforme o caso, nas seguintes bases legais da LGPD:</p>
        <ul>
          <li><strong>Consentimento</strong> (art. 7º, I) — contato via landing e cookies de análise.</li>
          <li><strong>Execução de contrato</strong> (art. 7º, V) — prestação do serviço às empresas clientes.</li>
          <li><strong>Cumprimento de obrigação legal/regulatória</strong> (art. 7º, II) — NR-1, NR-7, eSocial.</li>
          <li><strong>Legítimo interesse</strong> (art. 7º, IX) — segurança, prevenção a fraudes e melhoria do produto, sempre ponderado com seus direitos.</li>
          <li><strong>Tutela da saúde</strong> (art. 11, II, &ldquo;f&rdquo;) — encaminhamento clínico por profissional de saúde, para dados sensíveis.</li>
        </ul>
      </Secao>

      <Secao titulo="5. Barreira de privacidade e dados sensíveis">
        <p>
          A inteligência artificial da PrevIA opera <strong>somente sobre dados
          agregados</strong>. Casos individuais que demandem cuidado clínico não passam
          pela IA: são encaminhados ao profissional de saúde parceiro sob sigilo
          profissional, com cadeia de evidências e assinatura digital. Nada cruza essa
          barreira sem registro auditável.
        </p>
      </Secao>

      <Secao titulo="6. Cookies e analytics">
        <p>
          Usamos <strong>cookies essenciais</strong> (sessão, segurança), que não
          dependem de consentimento. Com a sua autorização, usamos também{" "}
          <strong>cookies de análise</strong> — Meta Pixel e Google Analytics 4 (com IP
          anonimizado) — para entender o uso do site e medir campanhas.
        </p>
        <p>
          Esses cookies de análise <strong>só são carregados após o seu aceite</strong> no
          banner de cookies. Você pode rever ou alterar sua decisão a qualquer momento
          pelo link <strong>&ldquo;Gerenciar cookies&rdquo;</strong> no rodapé do site. Recusar
          os cookies de análise não afeta o funcionamento básico da página.
        </p>
      </Secao>

      <Secao titulo="7. Compartilhamento">
        <p>
          Compartilhamos dados apenas quando necessário: com a empresa contratante
          (para os dados de seus colaboradores), com clínicas e profissionais parceiros
          (para o cuidado individual, sob sigilo), com fornecedores de infraestrutura e
          comunicação que atuam como operadores sob contrato, e com autoridades quando
          exigido por lei. Não vendemos dados pessoais.
        </p>
      </Secao>

      <Secao titulo="8. Retenção">
        <p>
          Mantemos os dados pelo tempo necessário às finalidades acima e às obrigações
          legais. Dados de leads são mantidos enquanto houver interesse de relacionamento
          comercial e são eliminados mediante pedido do titular. Trilhas de auditoria e
          documentos de conformidade são retidos pelos prazos legais aplicáveis.
        </p>
      </Secao>

      <Secao titulo="9. Direitos do titular">
        <p>Nos termos do art. 18 da LGPD, você pode solicitar, entre outros:</p>
        <ul>
          <li>confirmação da existência de tratamento e acesso aos dados;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>portabilidade e informação sobre compartilhamentos;</li>
          <li>revogação do consentimento e eliminação dos dados tratados com base nele.</li>
        </ul>
      </Secao>

      <Secao titulo="10. Como exercer seus direitos (DSAR)">
        <p>
          Para exercer qualquer direito, escreva ao DPO em{" "}
          <a href="mailto:dpo@p2a.tech">dpo@p2a.tech</a>. Responderemos no menor prazo
          possível, observados os requisitos de verificação de identidade para proteger
          seus próprios dados.
        </p>
      </Secao>

      <Secao titulo="11. Alterações desta política">
        <p>
          Podemos atualizar esta política para refletir mudanças legais ou no serviço.
          A data de última atualização consta no topo desta página.
        </p>
      </Secao>

      <p className="text-sm text-ink-muted">
        Veja também os nossos <Link href="/termos" className="text-ia underline hover:brightness-110">Termos de Uso</Link>.
      </p>
    </LegalShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Componentes de layout reutilizados pelas páginas legais                    */
/* -------------------------------------------------------------------------- */

export function LegalShell({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string;
  atualizadoEm: string;
  children: React.ReactNode;
}) {
  return (
    <main className="bg-app min-h-screen">
      <header className="border-b border-line/10 bg-navy/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 md:px-8">
          <Link href="/nr1" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-ia text-onaccent shadow-glow">
              <Brain className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-lg font-semibold tracking-tight text-ink">
                PrevIA
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                por P2A Tech
              </span>
            </div>
          </Link>
          <Link
            href="/nr1"
            className="rounded-lg border border-line/15 px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:border-ia/40 hover:text-ink"
          >
            ← Voltar ao site
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-ia/30 bg-ia/10 px-3 py-1 text-xs font-medium text-ia">
          <ShieldCheck className="h-3.5 w-3.5" /> LGPD · Lei 13.709/2018
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          {titulo}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Última atualização: {atualizadoEm}
        </p>

        <div className="mt-8 space-y-4 text-sm leading-relaxed text-ink-muted">
          {children}
        </div>
      </article>
    </main>
  );
}

export function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
        {titulo}
      </h2>
      <div className="space-y-3 [&_a]:text-ia [&_a]:underline hover:[&_a]:brightness-110 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5 [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}
