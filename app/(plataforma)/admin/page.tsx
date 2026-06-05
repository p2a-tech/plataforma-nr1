import {
  Building2,
  Users,
  Activity,
  Radio,
  FileSignature,
  Webhook,
  Database,
  FlaskConical,
  Clock,
  Lock,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { exigirSessao } from "@/lib/auth";
import {
  getAdminOverview,
  getClinicas,
  getUsuarios,
} from "@/lib/admin-queries";

// Console operacional — sempre reflete o estado atual do banco.
export const dynamic = "force-dynamic";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin P2A",
  sst: "Gestor SST",
  clinica: "Clínica",
};

const PAPEL_TONE: Record<string, "ia" | "humano" | "ok" | "neutro"> = {
  admin: "ia",
  sst: "humano",
  clinica: "ok",
};

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtDataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function AdminPage() {
  // Gate de papel também AQUI (não só no layout): no App Router o layout e a
  // page renderizam em paralelo, então o redirect do layout NÃO impede a page
  // de buscar e serializar os dados no RSC payload. Sem este guard, um usuário
  // não-admin consegue extrair clínicas/usuários/métricas via fetch direto,
  // mesmo recebendo a instrução de redirect. exigirSessao lança → queries não rodam.
  exigirSessao(["admin"]);

  const [overview, clinicas, usuarios] = await Promise.all([
    getAdminOverview(),
    getClinicas(),
    getUsuarios(),
  ]);

  const semDb = !overview.habilitado;

  const metricas: {
    id: string;
    rotulo: string;
    valor: string;
    sub: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "clinicas",
      rotulo: "Clínicas parceiras",
      valor: overview.clinicasTotal.toLocaleString("pt-BR"),
      sub: `${overview.clinicasAtivas} ativa(s) de ${overview.clinicasTotal}`,
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      id: "usuarios",
      rotulo: "Usuários",
      valor: overview.usuariosTotal.toLocaleString("pt-BR"),
      sub: Object.entries(overview.usuariosPorPapel)
        .map(([p, n]) => `${n} ${PAPEL_LABEL[p] ?? p}`)
        .join(" · ") || "nenhum",
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: "eventos",
      rotulo: "Eventos agregados",
      valor: overview.eventosAgregados.toLocaleString("pt-BR"),
      sub: "devolutivas anônimas da clínica",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      id: "pulsos",
      rotulo: "Respostas de pulso",
      valor: overview.pulsoRespostas.toLocaleString("pt-BR"),
      sub: "micro-pulsos do Radar",
      icon: <Radio className="h-4 w-4" />,
    },
    {
      id: "pgr",
      rotulo: "Assinaturas de PGR",
      valor: overview.assinaturasPgr.toLocaleString("pt-BR"),
      sub: "revisões assinadas (SESMT)",
      icon: <FileSignature className="h-4 w-4" />,
    },
    {
      id: "webhook",
      rotulo: "Eventos de webhook",
      valor: (overview.webhookAceitos + overview.webhookRejeitados).toLocaleString("pt-BR"),
      sub: `${overview.webhookAceitos} aceito(s) · ${overview.webhookRejeitados} rejeitado(s)`,
      icon: <Webhook className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Console Admin"
        descricao="Visão geral operacional da plataforma PrevIA — tenants, usuários e atividade. Somente leitura nesta versão."
        badge={
          semDb ? (
            <Badge tone="ambar">
              <FlaskConical className="h-3 w-3" /> Banco indisponível
            </Badge>
          ) : (
            <Badge tone="ok">
              <Database className="h-3 w-3" /> Dados reais
            </Badge>
          )
        }
        acao={
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Clock className="h-3.5 w-3.5" />
            Última atividade: {fmtData(overview.ultimaAtividade)}
          </span>
        }
      />

      {/* Cards de métrica */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {metricas.map((m) => (
          <Card key={m.id} className="p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <span className="text-ia">{m.icon}</span>
              {m.rotulo}
            </div>
            <div className="mt-1.5">
              <span className="stat-num">{m.valor}</span>
            </div>
            <div className="mt-1 text-xs text-ink-muted">{m.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Clínicas */}
        <Card className="lg:col-span-3">
          <CardTitle
            icon={<Building2 className="h-5 w-5" />}
            hint="Tenants que enviam devolutivas via webhook assinado (HMAC)"
            action={<Badge tone="neutro">{clinicas.length} registro(s)</Badge>}
          >
            Clínicas parceiras
          </CardTitle>
          {clinicas.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              Nenhuma clínica cadastrada.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line/5 bg-fill/[0.02] text-left text-xs uppercase tracking-wider text-ink-muted">
                    <th className="px-3 py-2 font-medium">Clínica</th>
                    <th className="px-3 py-2 font-medium">CNPJ</th>
                    <th className="px-3 py-2 font-medium">Desde</th>
                    <th className="px-3 py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicas.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-line/5 last:border-0 transition-colors hover:bg-fill/[0.03]"
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-ink">{c.nome}</div>
                        <div className="text-[11px] text-ink-muted">{c.id}</div>
                      </td>
                      <td className="px-3 py-2.5 text-ink/80">{c.cnpj ?? "—"}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{fmtDataCurta(c.criada_em)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Badge tone={c.ativa ? "ok" : "neutro"}>
                          {c.ativa ? "Ativa" : "Inativa"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Usuários */}
        <Card className="lg:col-span-2">
          <CardTitle
            icon={<Users className="h-5 w-5" />}
            hint="Acessos à plataforma por papel"
            action={<Badge tone="neutro">{usuarios.length} usuário(s)</Badge>}
          >
            Usuários
          </CardTitle>
          {usuarios.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              Nenhum usuário cadastrado.
            </p>
          ) : (
            <ul className="space-y-2">
              {usuarios.map((u) => (
                <li
                  key={u.email}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line/5 bg-fill/[0.02] px-3 py-2.5 transition-colors hover:bg-fill/[0.04]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {u.nome ?? u.email}
                    </div>
                    <div className="truncate text-[11px] text-ink-muted">
                      {u.email}
                      {u.clinica_id ? ` · ${u.clinica_id}` : ""}
                    </div>
                  </div>
                  <Badge tone={PAPEL_TONE[u.papel] ?? "neutro"}>
                    {PAPEL_LABEL[u.papel] ?? u.papel}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Nota de roadmap */}
      <Card className="flex items-start gap-3 border-ia/15 bg-ia/[0.04] p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ia" />
        <div className="text-sm text-ink/80">
          <span className="font-medium text-ink">Somente leitura.</span> A gestão de clínicas
          e usuários (criar, editar, suspender) está no roadmap. Esta versão entrega a visão
          geral operacional da plataforma.
        </div>
      </Card>
    </div>
  );
}
