import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppProvider } from "@/lib/app-state";
import { Shell } from "@/components/layout/shell";
import { getRadarResumo } from "@/lib/queries";
import { exigirSessao, isRotaSST, homePorPapel } from "@/lib/auth";
import { withEscopo, resolverEscopo, listaGrupo } from "@/lib/escopo";

export const dynamic = "force-dynamic";

export default async function PlataformaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate 1: toda a plataforma exige sessão válida (redireciona p/ /login).
  const sessao = exigirSessao();

  // Gate 2 (RBAC): rotas SST-only (dashboard/compliance org-wide) não podem ser
  // vistas por 'clinica'. O pathname chega via header setado no middleware.
  const pathname = headers().get("x-pathname") ?? "";
  if (sessao.papel === "clinica" && isRotaSST(pathname)) {
    redirect(homePorPapel(sessao.papel));
  }
  // Diretoria não acessa as áreas da clínica (Portal da Clínica / Atendimento + IA).
  if (
    sessao.papel === "diretoria" &&
    (pathname.startsWith("/clinica") || pathname.startsWith("/atendimento"))
  ) {
    redirect(homePorPapel(sessao.papel));
  }
  // E5 multi-tenancy: estabelece o escopo para as queries server-side.
  // Vidas monitoradas = alcance real do Radar (convidados).
  const radar = await withEscopo(sessao, () => getRadarResumo());

  // Escopo atual (rótulo da unidade/grupo exibido na sidebar e no seletor).
  const ehDiretoria = sessao.papel === "diretoria" || sessao.papel === "admin";
  const escopo = await resolverEscopo(sessao);
  const seletor = ehDiretoria
    ? {
        atual: escopo.empresaId ?? "global",
        label: escopo.label,
        opcoes: await listaGrupo(),
      }
    : undefined;

  return (
    <AppProvider>
      <Shell
        vidas={radar.alcance}
        empresaNome={escopo.label}
        usuario={{ nome: sessao.nome ?? sessao.email, papel: sessao.papel, email: sessao.email }}
        seletor={seletor}
      >
        {children}
      </Shell>
    </AppProvider>
  );
}
