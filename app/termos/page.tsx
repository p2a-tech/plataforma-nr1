import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Secao } from "../privacidade/page";

/**
 * Termos de Uso — página pública (sem auth).
 * Honesta sobre o que a plataforma faz: SaaS de conformidade NR-1, escuta DRPS,
 * encaminhamento clínico via parceiros. Não substitui aconselhamento jurídico
 * nem atendimento médico.
 */

export const metadata: Metadata = {
  title: "Termos de Uso · PrevIA | P2A Tech",
  description:
    "Termos de Uso da plataforma PrevIA (P2A Tech): objeto, cadastro, uso aceitável, propriedade intelectual, limitações e foro.",
  robots: { index: true, follow: true },
};

const ATUALIZADO_EM = "17 de junho de 2026";

export default function TermosDeUso() {
  return (
    <LegalShell titulo="Termos de Uso" atualizadoEm={ATUALIZADO_EM}>
      <p>
        Estes Termos de Uso regem o acesso e o uso da plataforma{" "}
        <strong>PrevIA</strong> e do site de divulgação, fornecidos pela{" "}
        <strong>P2A Tech</strong>. Ao acessar ou utilizar nossos serviços, você
        concorda com estes Termos. Se não concordar, não utilize a plataforma.
      </p>

      <Secao titulo="1. Objeto">
        <p>
          A PrevIA é uma plataforma de software (SaaS) que auxilia empresas na
          conformidade com a NR-1, na gestão de riscos psicossociais e na geração de
          documentos como o PGR e a exportação do eSocial S-2240. A plataforma combina
          análise por inteligência artificial sobre dados agregados com encaminhamento
          de cuidado individual a profissionais de saúde parceiros.
        </p>
      </Secao>

      <Secao titulo="2. Não substitui aconselhamento profissional">
        <p>
          A PrevIA é uma ferramenta de apoio. Ela <strong>não substitui</strong> o
          aconselhamento jurídico, a atuação de profissionais de segurança e medicina do
          trabalho, nem o atendimento clínico individual. As decisões e a responsabilidade
          final sobre a conformidade permanecem com a empresa e seus responsáveis técnicos.
        </p>
      </Secao>

      <Secao titulo="3. Cadastro e acesso">
        <p>
          O acesso à plataforma exige credenciais fornecidas no contexto de uma empresa
          contratante. Você é responsável por manter a confidencialidade de suas
          credenciais e por todas as atividades realizadas em sua conta. Comunique-nos
          imediatamente qualquer uso não autorizado.
        </p>
      </Secao>

      <Secao titulo="4. Uso aceitável">
        <p>Você concorda em não:</p>
        <ul>
          <li>usar a plataforma para fins ilícitos ou que violem direitos de terceiros;</li>
          <li>tentar acessar áreas, dados ou contas para os quais não tenha autorização;</li>
          <li>burlar mecanismos de segurança, k-anonimato ou trilhas de auditoria;</li>
          <li>inserir dados falsos ou de terceiros sem a devida base legal;</li>
          <li>realizar engenharia reversa ou cópia não autorizada do software.</li>
        </ul>
      </Secao>

      <Secao titulo="5. Dados e privacidade">
        <p>
          O tratamento de dados pessoais segue a nossa{" "}
          <Link href="/privacidade" className="text-ia underline hover:brightness-110">
            Política de Privacidade
          </Link>
          . Ao usar a plataforma como empresa contratante, você declara possuir base legal
          para o tratamento dos dados de seus colaboradores e atua como controladora desses
          dados.
        </p>
      </Secao>

      <Secao titulo="6. Propriedade intelectual">
        <p>
          A plataforma, sua metodologia (incluindo o instrumento DRPS), marcas, código e
          conteúdos são de titularidade da P2A Tech ou de seus licenciadores. O contrato
          concede a você uma licença de uso limitada, não exclusiva e intransferível,
          durante a vigência da contratação. Os dados inseridos pela empresa permanecem de
          sua titularidade.
        </p>
      </Secao>

      <Secao titulo="7. Disponibilidade e alterações">
        <p>
          Buscamos manter a plataforma disponível, mas podemos realizar manutenções,
          atualizações e melhorias que afetem temporariamente o acesso. Podemos alterar ou
          descontinuar funcionalidades, comunicando mudanças relevantes quando aplicável.
        </p>
      </Secao>

      <Secao titulo="8. Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida pela lei, a P2A Tech não se responsabiliza por danos
          indiretos, lucros cessantes ou por decisões tomadas exclusivamente com base nos
          relatórios gerados sem a devida validação dos responsáveis técnicos da empresa.
        </p>
      </Secao>

      <Secao titulo="9. Alterações destes Termos">
        <p>
          Podemos atualizar estes Termos periodicamente. A data de última atualização
          consta no topo desta página. O uso continuado após alterações implica concordância.
        </p>
      </Secao>

      <Secao titulo="10. Lei aplicável e foro">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito
          o foro do domicílio da P2A Tech para dirimir controvérsias, salvo disposição legal
          em contrário aplicável ao consumidor.
        </p>
      </Secao>

      <Secao titulo="11. Contato">
        <p>
          Dúvidas sobre estes Termos: <a href="mailto:contato@p2a.tech">contato@p2a.tech</a>.
          Assuntos de privacidade: <a href="mailto:dpo@p2a.tech">dpo@p2a.tech</a>.
        </p>
      </Secao>
    </LegalShell>
  );
}
