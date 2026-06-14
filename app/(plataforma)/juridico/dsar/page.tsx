import {
  Scale,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  FileWarning,
  ShieldCheck,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { exigirSessao } from "@/lib/auth";
import {
  listarPedidos,
  contarPedidosAbertos,
  type DsarPedido,
  type DsarStatus,
  type DsarTipo,
} from "@/lib/dsar";
import { transicaoDsar } from "./actions";

export const dynamic = "force-dynamic";

/* ----------------------------------------------------------------------------
 *  Página de gestão de DSAR (LGPD titular).
 *  Acesso: sst|admin. Admin vê cross-tenant (inclusive pedidos sem empresa).
 * ------------------------------------------------------------------------- */

const TIPO_LABEL: Record<DsarTipo, string> = {
  acesso: "Acesso aos dados",
  exclusao: "Exclusão",
  correcao: "Correção",
  portabilidade: "Portabilidade",
  revogacao_consentimento: "Revogação de consentimento",
  oposicao: "Oposição ao tratamento",
};

const STATUS_LABEL: Record<DsarStatus, string> = {
  recebido: "Recebido",
  em_analise: "Em análise",
  atendido: "Atendido",
  rejeitado: "Rejeitado",
};

const STATUS_TONE: Record<DsarStatus, "ambar" | "ia" | "ok" | "alerta"> = {
  recebido: "ambar",
  em_analise: "ia",
  atendido: "ok",
  rejeitado: "alerta",
};

const SLA_DIAS = 15; // LGPD: prazo razoável de resposta ao titular.

export default async function DsarPage() {
  // CRÍTICO: gate no TOPO da PRÓPRIA page (layout-only não bloqueia).
  const sessao = exigirSessao(["sst", "admin"]);

  const [pedidos, abertos] = await Promise.all([
    listarPedidos({ papel: sessao.papel as "sst" | "admin", empresaId: sessao.empresa_id }),
    contarPedidosAbertos({ papel: sessao.papel as "sst" | "admin", empresaId: sessao.empresa_id }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Pedidos LGPD (DSAR)"
        descricao="Direitos do titular de dados (LGPD arts. 18-22) — acesso, exclusão, correção, portabilidade, revogação de consentimento e oposição."
        badge={
          <Badge tone="ia">
            <Scale className="h-3 w-3" /> {sessao.papel === "admin" ? "Visão cross-tenant" : "Empresa"}
          </Badge>
        }
      />

      {/* SLA strip */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SlaCard
          icon={<Clock className="h-5 w-5" />}
          tone={abertos.total > 0 ? "ambar" : "ok"}
          titulo="Pedidos abertos"
          valor={abertos.total}
          legenda="Status `recebido` ou `em_análise`"
        />
        <SlaCard
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={abertos.vencidos15d > 0 ? "alerta" : "ok"}
          titulo={`Vencidos (> ${SLA_DIAS}d)`}
          valor={abertos.vencidos15d}
          legenda="Risco de notificação à ANPD — priorizar atendimento"
        />
        <SlaCard
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="ia"
          titulo="Total no histórico"
          valor={pedidos.length}
          legenda={`Carregando ${pedidos.length} pedido(s) mais recentes`}
        />
      </div>

      {/* Tabela */}
      <Card>
        <CardTitle
          icon={<FileWarning className="h-5 w-5" />}
          hint="Cada pedido deve ser respondido com cadeia de custódia (LGPD art. 9º e 19)."
          action={<Badge tone="neutro">{pedidos.length} pedidos</Badge>}
        >
          Pedidos recebidos
        </CardTitle>

        {pedidos.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            Nenhum pedido DSAR registrado ainda. O canal público{" "}
            <code className="rounded bg-fill/10 px-1.5 py-0.5 text-xs text-ia">POST /api/dsar</code>{" "}
            já está ativo.
          </p>
        ) : (
          <div className="space-y-3">
            {pedidos.map((p) => (
              <PedidoLinha key={p.id} pedido={p} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================================
 *  Linha de pedido — exibe metadados + ações de transição.
 * ========================================================================= */
function PedidoLinha({ pedido }: { pedido: DsarPedido }) {
  const criado = new Date(pedido.criado_em);
  const diasAberto = Math.floor((Date.now() - criado.getTime()) / 86_400_000);
  const venceuSla =
    (pedido.status === "recebido" || pedido.status === "em_analise") && diasAberto >= SLA_DIAS;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        venceuSla
          ? "border-alerta/30 bg-alerta/[0.06]"
          : "border-line/5 bg-fill/[0.02] hover:bg-fill/[0.04]"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{pedido.email_titular}</span>
            <Badge tone={STATUS_TONE[pedido.status]}>{STATUS_LABEL[pedido.status]}</Badge>
            <Badge tone="neutro">{TIPO_LABEL[pedido.tipo]}</Badge>
            {pedido.empresa_id ? (
              <span className="rounded-md bg-fill/10 px-2 py-0.5 text-[11px] text-ink-muted">
                {pedido.empresa_id}
              </span>
            ) : (
              <Badge tone="ambar">Sem empresa</Badge>
            )}
            {venceuSla && (
              <Badge tone="alerta">
                <AlertTriangle className="h-3 w-3" /> SLA vencido
              </Badge>
            )}
          </div>
          <div className="mt-1 text-xs text-ink-muted">
            ID <code className="font-mono text-ink/70">{pedido.id.slice(0, 8)}</code> ·{" "}
            recebido em {criado.toLocaleString("pt-BR")} ·{" "}
            há {diasAberto}d
            {pedido.atendido_por && (
              <>
                {" "}
                · atendido por <span className="text-ink">{pedido.atendido_por}</span>
              </>
            )}
          </div>
          {pedido.justificativa && (
            <p className="mt-2 rounded-lg border border-line/5 bg-fill/[0.02] p-2.5 text-xs leading-relaxed text-ink/80">
              {pedido.justificativa}
            </p>
          )}
          {pedido.resposta && (
            <p className="mt-2 rounded-lg border border-ok/15 bg-ok/[0.05] p-2.5 text-xs leading-relaxed text-ink/85">
              <strong className="text-ok">Resposta:</strong> {pedido.resposta}
            </p>
          )}
        </div>

        {/* Ações de transição */}
        {(pedido.status === "recebido" || pedido.status === "em_analise") && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {pedido.status === "recebido" && (
              <AcaoForm id={pedido.id} novoStatus="em_analise" rotulo="Iniciar análise" icone={<Search className="h-3.5 w-3.5" />} />
            )}
            <AcaoFormResposta id={pedido.id} novoStatus="atendido" rotulo="Atender" icone={<CheckCircle2 className="h-3.5 w-3.5" />} tone="ok" />
            <AcaoFormResposta id={pedido.id} novoStatus="rejeitado" rotulo="Rejeitar" icone={<XCircle className="h-3.5 w-3.5" />} tone="alerta" />
          </div>
        )}
      </div>
    </div>
  );
}

function AcaoForm({
  id,
  novoStatus,
  rotulo,
  icone,
}: {
  id: string;
  novoStatus: DsarStatus;
  rotulo: string;
  icone: React.ReactNode;
}) {
  return (
    <form action={transicaoDsar}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={novoStatus} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg border border-ia/30 bg-ia/10 px-3 py-1.5 text-xs font-medium text-ia transition hover:bg-ia/20"
      >
        {icone} {rotulo}
      </button>
    </form>
  );
}

function AcaoFormResposta({
  id,
  novoStatus,
  rotulo,
  icone,
  tone,
}: {
  id: string;
  novoStatus: DsarStatus;
  rotulo: string;
  icone: React.ReactNode;
  tone: "ok" | "alerta";
}) {
  const cor =
    tone === "ok"
      ? "border-ok/30 bg-ok/10 text-ok hover:bg-ok/20"
      : "border-alerta/30 bg-alerta/10 text-alerta hover:bg-alerta/20";
  return (
    <details className="group">
      <summary
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${cor}`}
      >
        {icone} {rotulo}
      </summary>
      <form action={transicaoDsar} className="mt-2 space-y-2 rounded-lg border border-line/10 bg-fill/[0.03] p-2.5">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={novoStatus} />
        <textarea
          name="resposta"
          rows={2}
          required
          placeholder="Resposta ao titular (registrada na trilha)…"
          className="w-full rounded-md border border-line/15 bg-fill/5 px-2 py-1.5 text-xs text-ink placeholder:text-ink-muted/70 focus:border-ia/50 focus:outline-none focus:ring-1 focus:ring-ia/20"
        />
        <button
          type="submit"
          className={`w-full rounded-md border px-2 py-1 text-[11px] font-medium ${cor}`}
        >
          Confirmar
        </button>
      </form>
    </details>
  );
}

/* ============================================================================
 *  Helpers
 * ========================================================================= */
function SlaCard({
  icon,
  tone,
  titulo,
  valor,
  legenda,
}: {
  icon: React.ReactNode;
  tone: "ok" | "ambar" | "alerta" | "ia";
  titulo: string;
  valor: number;
  legenda: string;
}) {
  const color = {
    ok: "text-ok",
    ambar: "text-humano-soft",
    alerta: "text-alerta",
    ia: "text-ia",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <span className={`inline-flex ${color}`}>{icon}</span>
        {titulo}
      </div>
      <div className={`mt-1.5 font-display text-3xl font-semibold tracking-tight ${color}`}>
        {valor.toLocaleString("pt-BR")}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{legenda}</p>
    </Card>
  );
}
