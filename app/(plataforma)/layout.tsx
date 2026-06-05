import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppProvider } from "@/lib/app-state";
import { Shell } from "@/components/layout/shell";
import { getRadarResumo } from "@/lib/queries";
import { exigirSessao, isRotaSST, homePorPapel } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";

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
  // E5 multi-tenancy: estabelece o escopo para as queries server-side.
  // Vidas monitoradas = alcance real do Radar (convidados).
  const radar = await withEmpresa(sessao.empresa_id, () => getRadarResumo());

  return (
    <AppProvider>
      <Shell
        vidas={radar.alcance}
        usuario={{ nome: sessao.nome ?? sessao.email, papel: sessao.papel, email: sessao.email }}
      >
        {children}
      </Shell>
    </AppProvider>
  );
}
