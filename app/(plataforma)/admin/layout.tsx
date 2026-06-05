import { ShieldCheck } from "lucide-react";
import { exigirSessao } from "@/lib/auth";
import { P2ALogo } from "@/components/brand/p2a-logo";

/**
 * Gate do Console Admin (P2A). O layout da plataforma já exige login + RBAC
 * SST-only, mas /admin NÃO está na lista SST-only — então o gate de papel
 * 'admin' precisa ser feito AQUI. `exigirSessao(['admin'])` redireciona:
 *   - sem sessão → /login
 *   - papel ≠ admin → home do papel (sst→/dashboard, clinica→/atendimento)
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  exigirSessao(["admin"]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line/10 bg-fill/[0.02] px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-ia" />
          Console Admin
        </span>
        <P2ALogo size="xs" />
      </div>
      {children}
    </div>
  );
}
