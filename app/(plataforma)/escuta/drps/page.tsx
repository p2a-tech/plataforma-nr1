import { ClipboardList, Link2, Smartphone, BarChart3 } from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { exigirSessao } from "@/lib/auth";
import {
  listarInstrumentosAtivos,
  listarRespostas,
  resumoAdesao,
  adesaoPorSetor,
  tokenDeCampanha,
} from "@/lib/drps";
import { CopyLinkButton } from "./copy-link";

export const dynamic = "force-dynamic";

export default async function DrpsPage() {
  // Auth NO TOPO da própria page (App Router renderiza layout em paralelo).
  const sessao = exigirSessao(["sst", "admin"]);
  const empresaId = sessao.empresa_id;

  const [instrumentos, resumo, porSetor, recentes] = await Promise.all([
    listarInstrumentosAtivos(empresaId),
    resumoAdesao(empresaId),
    adesaoPorSetor(empresaId),
    listarRespostas(empresaId, { limit: 20 }),
  ]);

  const token = tokenDeCampanha(empresaId);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="DRPS · Diagnóstico de Riscos Psicossociais"
        descricao="Questionário NR-1 (21 perguntas) — captura anônima por colaborador. Compartilhe o link da campanha por WhatsApp/e-mail."
        badge={
          <Badge tone={resumo.total > 0 ? "ok" : "ambar"}>
            <ClipboardList className="h-3 w-3" />{" "}
            {resumo.total} resposta{resumo.total === 1 ? "" : "s"} coletada
            {resumo.total === 1 ? "" : "s"}
          </Badge>
        }
      />

      {/* ── Instrumentos ativos ── */}
      <Card>
        <CardTitle
          icon={<ClipboardList className="h-5 w-5" />}
          hint="Templates globais + instrumentos próprios da empresa."
          action={
            <Badge tone="ia">
              {instrumentos.length} ativo{instrumentos.length === 1 ? "" : "s"}
            </Badge>
          }
        >
          Instrumentos ativos
        </CardTitle>

        {instrumentos.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Nenhum instrumento ativo no momento.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {instrumentos.map((i) => {
              const isGlobal = i.empresa_id === null;
              const link = `/r/drps/${token}`;
              return (
                <div
                  key={i.id}
                  className="rounded-xl border border-line/10 bg-fill/5 p-4"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {i.titulo}
                    </span>
                    <Badge tone={isGlobal ? "ia" : "humano"}>
                      {isGlobal ? "global" : "próprio"}
                    </Badge>
                  </div>
                  {i.descricao && (
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {i.descricao}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <CopyLinkButton path={link} />
                    <code className="truncate rounded-md bg-fill/10 px-2 py-1 text-[11px] text-ink-muted">
                      {link}
                    </code>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Adesão (KPIs simples) ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total de respostas"
          value={resumo.total}
          hint="Colaboradores anônimos que concluíram o DRPS"
        />
        <KpiCard
          label="Setores com adesão"
          value={porSetor.filter((s) => s.setor !== "(não informado)").length}
          hint="Setores distintos respondendo"
        />
        <KpiCard
          label="Maior canal"
          value={resumo.por_canal[0]?.canal ?? "—"}
          hint={
            resumo.por_canal[0]
              ? `${resumo.por_canal[0].n} resp. por ${resumo.por_canal[0].canal}`
              : "Aguardando respostas"
          }
        />
        <KpiCard
          label="Formas de atuação"
          value={resumo.por_forma_atuacao.length}
          hint="Diversidade de vínculos (CLT/PJ/Estágio etc.)"
        />
      </div>

      {/* ── Distribuição por setor ── */}
      <Card>
        <CardTitle
          icon={<BarChart3 className="h-5 w-5" />}
          hint="Quantas respostas vieram de cada setor (auto-declarado)."
        >
          Adesão por setor
        </CardTitle>
        {porSetor.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            Sem respostas ainda. Compartilhe o link da campanha.
          </p>
        ) : (
          <div className="space-y-3">
            {porSetor.map((s) => (
              <div
                key={s.setor}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-ink/85">{s.setor}</span>
                <span className="font-medium text-ink">{s.respostas}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Respostas recentes (anônimas) ── */}
      <Card>
        <CardTitle
          icon={<Smartphone className="h-5 w-5" />}
          hint="Apenas setor/função/timestamp. Nada que identifique o colaborador."
          action={<Badge tone="ia">{recentes.length} recentes</Badge>}
        >
          Respostas recentes (anônimas)
        </CardTitle>

        {recentes.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Nenhuma resposta registrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-2 pr-3">Setor</th>
                  <th className="py-2 pr-3">Função</th>
                  <th className="py-2 pr-3">Tempo</th>
                  <th className="py-2 pr-3">Forma</th>
                  <th className="py-2 pr-3">Canal</th>
                  <th className="py-2 pr-3">Recebida em</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-line/5 text-ink/85"
                  >
                    <td className="py-2 pr-3">{r.setor ?? "—"}</td>
                    <td className="py-2 pr-3">{r.funcao ?? "—"}</td>
                    <td className="py-2 pr-3">{r.tempo_empresa ?? "—"}</td>
                    <td className="py-2 pr-3">{r.forma_atuacao ?? "—"}</td>
                    <td className="py-2 pr-3">{r.canal}</td>
                    <td className="py-2 pr-3 text-ink-muted">
                      {new Date(r.respondido_em).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className="mt-2 stat-num">{value}</div>
      {hint && (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
          {hint}
        </p>
      )}
    </Card>
  );
}
