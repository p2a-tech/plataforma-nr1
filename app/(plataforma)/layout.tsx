import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppProvider } from "@/lib/app-state";
import { Shell } from "@/components/layout/shell";
import { getRadarResumo } from "@/lib/queries";
import { exigirSessao, isRotaSST, homePorPapel } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import { registrarAcesso } from "@/lib/audit-access";

export const dynamic = "force-dynamic";

/**
 * Rotas tratadas como "sensíveis" para a LGPD — todo acesso autenticado é
 * registrado em `acesso_log` (LGPD art. 37). Não substitui gating (RBAC já
 * está nas pages); é apenas trilha de auditoria.
 */
const ROTAS_AUDITADAS = [
  "/juridico",
  "/governanca",
  "/admin",
  "/pgr",
  "/riscos",
  "/escuta/risco-grave",
];

function isRotaAuditada(pathname: string): boolean {
  return ROTAS_AUDITADAS.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

function pickIp(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip");
}

export default async function PlataformaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate 1: toda a plataforma exige sessão válida (redireciona p/ /login).
  const sessao = exigirSessao();

  // Gate 2 (RBAC): rotas SST-only (dashboard/compliance org-wide) não podem ser
  // vistas por 'clinica'. O pathname chega via header setado no middleware.
  const h = headers();
  const pathname = h.get("x-pathname") ?? "";
  if (sessao.papel === "clinica" && isRotaSST(pathname)) {
    redirect(homePorPapel(sessao.papel));
  }

  // Trilha de auditoria (LGPD art. 37): rotas sensíveis registram quem entrou.
  // try/catch silencioso — auditoria nunca bloqueia render.
  if (pathname && isRotaAuditada(pathname)) {
    try {
      await registrarAcesso({
        empresaId: sessao.empresa_id ?? null,
        usuarioEmail: sessao.email,
        papel: sessao.papel,
        rota: pathname,
        ip: pickIp(h),
      });
    } catch {
      /* silenciado intencionalmente */
    }
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
