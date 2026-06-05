import {
  FileSignature,
  ShieldCheck,
  Hash,
  PenLine,
  AlertTriangle,
  History,
  Fingerprint,
  CheckCircle2,
  Bot,
  FileDown,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge, ProgressBar } from "@/components/ui/primitives";
import { empresa } from "@/lib/mock-data";
import { getPgrStatus, type PgrAssinatura } from "@/lib/queries";
import { AssinarForm } from "./assinar-form";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function dataFmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function PgrPage() {
  const sessao = exigirSessao(["sst", "admin"]);
  const pgr = await withEmpresa(sessao.empresa_id, () => getPgrStatus());
  const { resumo, ultima, pendente, motivo } = pgr;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="PGR · Assinatura Digital"
        descricao={`${empresa.nome}. A IA mantém o PGR vivo; o responsável técnico assina a versão — decisão humana, registrada e à prova de adulteração.`}
        badge={
          pendente ? (
            <Badge tone="ambar">
              <PenLine className="h-3 w-3" /> Validação humana pendente
            </Badge>
          ) : (
            <Badge tone="ok">
              <ShieldCheck className="h-3 w-3" /> Assinado e vigente · rev {pgr.revisaoVigente}
            </Badge>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Snapshot do PGR */}
        <Card className="lg:col-span-3">
          <CardTitle
            icon={<Bot className="h-5 w-5" />}
            hint="Conteúdo computado automaticamente a partir dos atendimentos reais"
            action={<Badge tone="ia">rev {pendente ? pgr.proximaRevisao : pgr.revisaoVigente}</Badge>}
          >
            Snapshot do documento
          </CardTitle>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Conformidade" valor={`${resumo.conformidade}%`} />
            <Metric label="Riscos mapeados" valor={String(resumo.totalRiscos)} />
            <Metric label="Atendimentos" valor={String(resumo.totalEventos)} />
            <Metric label="Críticos+Altos" valor={String(resumo.criticos + resumo.altos)} tone="alerta" />
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-ink-muted">Conformidade NR-1</span>
              <span className="font-medium text-ink">{resumo.conformidade}%</span>
            </div>
            <ProgressBar value={resumo.conformidade} tone="ia" />
          </div>

          {/* Distribuição de severidade */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="alerta">{resumo.criticos} críticos</Badge>
            <Badge tone="humano">{resumo.altos} altos</Badge>
            <Badge tone="ambar">{resumo.medios} médios</Badge>
            <Badge tone="ia">{resumo.baixos} baixos</Badge>
          </div>

          {/* Hash do conteúdo */}
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-line/5 bg-fill/[0.02] p-3">
            <Hash className="mt-0.5 h-4 w-4 shrink-0 text-ia" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-ink-muted">Hash do conteúdo (SHA-256)</div>
              <div className="mt-0.5 break-all font-mono text-xs text-ink/80">{pgr.conteudoHash}</div>
              <p className="mt-1 text-[11px] text-ink-muted">
                Impressão digital determinística do PGR. Qualquer novo atendimento que altere riscos
                ou conformidade muda este hash — e exige nova assinatura.
              </p>
            </div>
          </div>
        </Card>

        {/* Status da assinatura / formulário */}
        <Card className="lg:col-span-2">
          <CardTitle
            icon={<FileSignature className="h-5 w-5" />}
            hint="Responsabilidade técnica — Eng. de Segurança / SESMT"
          >
            Assinatura do responsável
          </CardTitle>

          {!pendente && ultima ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-ok/25 bg-ok/[0.06] p-3.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" />
                <div>
                  <div className="text-sm font-medium text-ink">PGR assinado e vigente</div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Revisão {ultima.revisao} cobre exatamente o conteúdo atual.
                  </p>
                </div>
              </div>
              <AssinaturaInfo a={ultima} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-humano-soft/30 bg-humano-soft/[0.08] p-3.5">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-humano-soft" />
                <div>
                  <div className="text-sm font-medium text-ink">
                    {motivo === "conteudo_alterado"
                      ? "Conteúdo alterado desde a última assinatura"
                      : "Documento ainda não assinado"}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {motivo === "conteudo_alterado"
                      ? `Novos atendimentos mudaram o PGR. A revisão ${ultima?.revisao ?? ""} não cobre mais o estado atual — assine a revisão ${pgr.proximaRevisao}.`
                      : "Como responsável técnico, revise o snapshot ao lado e assine para validar o PGR."}
                  </p>
                </div>
              </div>
              <AssinarForm proximaRevisao={pgr.proximaRevisao} hashCurto={pgr.conteudoHash.slice(0, 12)} />
            </div>
          )}
        </Card>
      </div>

      {/* Histórico de revisões */}
      <Card>
        <CardTitle
          icon={<History className="h-5 w-5" />}
          hint="Cada assinatura é uma evidência datada e selada (HMAC)"
          action={<Badge tone="neutro">{pgr.historico.length} revisões</Badge>}
        >
          Histórico de assinaturas
        </CardTitle>
        {pgr.historico.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            Nenhuma assinatura ainda. A primeira validação humana aparece aqui.
          </p>
        ) : (
          <div className="space-y-2.5">
            {pgr.historico.map((a) => (
              <div
                key={a.revisao}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line/5 bg-fill/[0.02] p-3 text-sm"
              >
                <Badge tone="ia">rev {a.revisao}</Badge>
                <span className="font-medium text-ink">{a.assinante_nome}</span>
                <span className="text-ink-muted">{a.assinante_papel}</span>
                {a.assinante_registro && (
                  <span className="text-xs text-ink-muted">· {a.assinante_registro}</span>
                )}
                <span className="ml-auto text-xs text-ink-muted">{dataFmt(a.assinado_em)}</span>
                <a
                  href={`/api/pgr/${a.revisao}/pdf`}
                  className="flex items-center gap-1.5 rounded-lg bg-ia/10 px-2.5 py-1 text-xs font-medium text-ia ring-1 ring-inset ring-ia/25 hover:bg-ia/20"
                >
                  <FileDown className="h-3.5 w-3.5" /> PDF
                </a>
                <span className="flex w-full items-center gap-1.5 font-mono text-[11px] text-ink-muted">
                  <Fingerprint className="h-3 w-3 text-ia" /> hash {a.conteudo_hash.slice(0, 16)}… · selo{" "}
                  {a.selo.slice(0, 12)}…
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, valor, tone }: { label: string; valor: string; tone?: "alerta" }) {
  return (
    <div className="rounded-xl border border-line/5 bg-fill/[0.02] p-3">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className={`mt-0.5 font-display text-xl font-semibold ${tone === "alerta" ? "text-alerta" : "text-ink"}`}>
        {valor}
      </div>
    </div>
  );
}

function AssinaturaInfo({ a }: { a: PgrAssinatura }) {
  return (
    <div className="space-y-2 rounded-xl border border-line/5 bg-fill/[0.02] p-3.5 text-sm">
      <Linha rotulo="Assinado por">{a.assinante_nome}</Linha>
      <Linha rotulo="Função">{a.assinante_papel}</Linha>
      {a.assinante_registro && <Linha rotulo="Registro">{a.assinante_registro}</Linha>}
      <Linha rotulo="Data">{new Date(a.assinado_em).toLocaleString("pt-BR")}</Linha>
      <div className="flex items-center gap-1.5 border-t border-line/5 pt-2 font-mono text-[11px] text-ink-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-ok" /> selo {a.selo.slice(0, 24)}…
      </div>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{rotulo}</span>
      <span className="font-medium text-ink">{children}</span>
    </div>
  );
}
