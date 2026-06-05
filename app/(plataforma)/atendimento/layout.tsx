import { exigirSessao } from "@/lib/auth";
import { SessaoBar } from "./sessao-bar";

/**
 * Área operacional da clínica — exige papel clinica (admin também acessa).
 * Outros papéis são redirecionados para a home deles.
 */
export default function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  const sessao = exigirSessao(["clinica", "admin"]);
  return (
    <div>
      <SessaoBar clinicaId={sessao.clinica_id ?? "—"} nome={sessao.nome ?? sessao.email} />
      {children}
    </div>
  );
}
