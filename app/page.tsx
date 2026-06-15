import { redirect } from "next/navigation";
import { getSessao, homePorPapel } from "@/lib/auth";

/**
 * Raiz (/) — NÃO é mais tela de login.
 *
 * O sistema tem dois logins normais:
 *   - /login          → empresa / SST / admin (admin cai em /admin)
 *   - /login-clinica  → clínica parceira
 *
 * A raiz apenas roteia: se há sessão, vai para a home do papel; senão, /login.
 *
 * Obs.: no host de marketing (nr1.p2atech.com.br) o middleware reescreve
 * "/" → "/nr1" ANTES de chegar aqui, então este redirect só vale no domínio
 * da plataforma (previa.p2atech.com.br).
 */
export const dynamic = "force-dynamic";

export default function Home() {
  const sessao = getSessao();
  redirect(sessao ? homePorPapel(sessao.papel) : "/login");
}
