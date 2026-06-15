import Link from "next/link";
import {
  Users,
  ArrowLeft,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { EmptyStateInline } from "@/components/ui/empty-state";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import { listarColaboradores, contarPorSetor } from "@/lib/colaboradores";

export const dynamic = "force-dynamic";

export default async function ColaboradoresPage() {
  // exigirSessao no TOPO da própria page (App Router renderiza layout+page em paralelo).
  const sessao = exigirSessao(["sst", "admin"]);

  const { colaboradores, porSetor } = await withEmpresa(
    sessao.empresa_id,
    async () => ({
      colaboradores: await listarColaboradores(sessao.empresa_id),
      porSetor: await contarPorSetor(sessao.empresa_id),
    }),
  );

  const ativos = colaboradores.filter((c) => c.ativo).length;
  const { ColaboradoresUpload, ToggleAtivo } = await import("./cliente");

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Colaboradores · eSocial S-2240"
        descricao="Quadro de RH (CPF, setor) usado para gerar o S-2240 por trabalhador. Dado do empregador, isolado por empresa e separado das respostas anônimas do DRPS."
        badge={
          <Badge tone="ia">
            <Users className="h-3 w-3" /> {ativos} ativo{ativos === 1 ? "" : "s"}
          </Badge>
        }
        acao={
          <Link
            href="/conformidade"
            className="inline-flex items-center gap-2 rounded-xl border border-line/10 bg-fill/5 px-3.5 py-2 text-sm font-medium text-ink-muted transition hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar à Conformidade
          </Link>
        }
      />

      {/* Barreira de privacidade */}
      <div className="flex items-start gap-3 rounded-xl border border-ok/20 bg-ok/[0.06] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ok" />
        <div>
          <p className="text-sm font-medium text-ink">
            Separação registro × respostas anônimas
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink/70">
            Os CPFs aqui são dados de RH do empregador, isolados por RLS. Não há ligação com as
            respostas do DRPS (anônimas, k-anonimato ≥ 7). O risco é mapeado por{" "}
            <strong className="text-ink/85">setor</strong> e aplicado a cada trabalhador do setor —
            sem identificar quem respondeu o quê. O CPF aparece mascarado nesta tela; só o gerador do
            XML do S-2240 usa o CPF cru.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Tabela */}
        <Card className="lg:col-span-3">
          <CardTitle
            icon={<Users className="h-5 w-5" />}
            hint="CPF mascarado (LGPD). Clique no status para ativar/inativar."
            action={<Badge tone="neutro">{colaboradores.length} no total</Badge>}
          >
            Quadro de colaboradores
          </CardTitle>

          {colaboradores.length === 0 ? (
            <EmptyStateInline
              icon={<FileSpreadsheet className="h-5 w-5" />}
              titulo="Nenhum colaborador cadastrado"
              descricao="Importe um CSV com cpf, nome, matrícula, setor e cargo para habilitar o S-2240 por trabalhador."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="py-2 pr-3">CPF</th>
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">Matrícula</th>
                    <th className="py-2 pr-3">Setor</th>
                    <th className="py-2 pr-3">Cargo</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {colaboradores.map((c) => (
                    <tr key={c.id} className="border-t border-line/5 align-middle">
                      <td className="py-2 pr-3">
                        <code className="text-[11px] text-ink/85">{c.cpf}</code>
                      </td>
                      <td className="py-2 pr-3 text-ink/85">{c.nome ?? "—"}</td>
                      <td className="py-2 pr-3 text-ink-muted">{c.matricula ?? "—"}</td>
                      <td className="py-2 pr-3 text-ink/85">{c.setor}</td>
                      <td className="py-2 pr-3 text-ink-muted">{c.cargo ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <ToggleAtivo id={c.id} ativo={c.ativo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Contagem por setor */}
        <Card className="lg:col-span-2">
          <CardTitle
            icon={<Building2 className="h-5 w-5" />}
            hint="Ativos por setor — base do fan-out do S-2240."
          >
            Por setor
          </CardTitle>
          {porSetor.length === 0 ? (
            <EmptyStateInline titulo="Sem dados ainda" descricao="A contagem aparece após o import." />
          ) : (
            <ul className="space-y-2">
              {porSetor.map((s) => (
                <li
                  key={s.setor}
                  className="flex items-center justify-between rounded-xl border border-line/5 bg-fill/[0.02] px-3 py-2.5 text-sm"
                >
                  <span className="text-ink/85">{s.setor}</span>
                  <Badge tone="ia">{s.total}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ColaboradoresUpload />
    </div>
  );
}
