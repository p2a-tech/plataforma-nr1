/**
 * /pgr/[revisao]/preview — renderiza HTML server-side das 9 seções do PGR
 * Okêbambo (Onda 4 · §6). Sem download; só visualização antes da assinatura.
 *
 * Auth: sst|admin.
 */

import Link from "next/link";
import { ArrowLeft, FileDown, ShieldCheck, Hash } from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import { empresa } from "@/lib/mock-data";
import { getPgrStatus, getInventarioRiscos } from "@/lib/queries";
import { obterRevisaoPorNumero } from "@/lib/pgr";

export const dynamic = "force-dynamic";

const NAO = "(não informado)";
const v = (x: string | null | undefined) => (x && x.trim() !== "" ? x : NAO);

function nivelTxt(s: number, p: number): { label: string; tone: "alerta" | "humano" | "ambar" | "ia" } {
  const score = s * p;
  if (score >= 15) return { label: "Crítico", tone: "alerta" };
  if (score >= 9) return { label: "Alto", tone: "humano" };
  if (score >= 4) return { label: "Médio", tone: "ambar" };
  return { label: "Baixo", tone: "ia" };
}
function rotuloProb(p: number) {
  if (p <= 2) return "Baixa";
  if (p <= 3) return "Média";
  return "Alta";
}
function rotuloImp(s: number) {
  if (s <= 2) return "Baixo";
  if (s <= 3) return "Médio";
  return "Alto";
}

export default async function PgrPreviewPage({
  params,
}: {
  params: { revisao: string };
}) {
  const sessao = exigirSessao(["sst", "admin"]);
  const revisao = Number(params.revisao);

  const { dados, riscos, pgr } = await withEmpresa(sessao.empresa_id, async () => {
    const dados = Number.isInteger(revisao) ? await obterRevisaoPorNumero(revisao) : null;
    const { riscos } = await getInventarioRiscos();
    const pgr = await getPgrStatus();
    return { dados, riscos, pgr };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`PGR · Pré-visualização (rev ${revisao})`}
        descricao="Renderização server-side das 9 seções do formato Okêbambo. Confira antes da assinatura digital."
        badge={
          <Badge tone="ia">
            <Hash className="h-3 w-3" /> hash {pgr.conteudoHash.slice(0, 12)}…
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/pgr"
          className="flex items-center gap-1.5 rounded-lg bg-fill/[0.04] px-3 py-1.5 text-xs font-medium text-ink-muted ring-1 ring-inset ring-line/10 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para PGR
        </Link>
        {pgr.ultima && pgr.ultima.revisao === revisao && (
          <a
            href={`/api/pgr/${revisao}/pdf`}
            className="flex items-center gap-1.5 rounded-lg bg-ia/10 px-3 py-1.5 text-xs font-medium text-ia ring-1 ring-inset ring-ia/25 hover:bg-ia/20"
          >
            <FileDown className="h-3.5 w-3.5" /> Baixar PDF assinado
          </a>
        )}
      </div>

      {/* Seção 1 */}
      <Card>
        <CardTitle>1. Identificação da empresa</CardTitle>
        <dl className="grid gap-2 md:grid-cols-2">
          <KV k="Razão social" v={v(dados?.razao_social ?? empresa.nome)} />
          <KV k="Nome fantasia" v={v(dados?.nome_fantasia ?? empresa.nome)} />
          <KV k="CNPJ" v={v(dados?.cnpj ?? empresa.cnpj)} />
          <KV k="Endereço" v={v(dados?.endereco)} />
          <KV
            k="Responsável técnico"
            v={`${v(dados?.responsavel_tecnico_nome)} · ${v(dados?.responsavel_tecnico_conselho)} ${v(dados?.responsavel_tecnico_registro)}`}
          />
          <KV k="Nº atendimentos no snapshot" v={String(pgr.resumo.totalEventos)} />
        </dl>
      </Card>

      {/* Seção 2 */}
      <Card>
        <CardTitle>2. Objetivo do PGR</CardTitle>
        <p className="text-sm text-ink/90">
          Promover a saúde, a segurança e o bem-estar dos profissionais da clínica por meio da
          identificação, avaliação, controle e monitoramento contínuo dos riscos ocupacionais — em
          particular, dos riscos psicossociais previstos na NR-1 (Portaria MTE 1.419/2024). Este
          programa orienta as ações preventivas e interventivas, assegurando ambiente de trabalho
          saudável, respeitoso e em conformidade com a legislação aplicável.
        </p>
      </Card>

      {/* Seção 3 */}
      <Card>
        <CardTitle>3. Caracterização das atividades</CardTitle>
        <dl className="space-y-2">
          <KV k="Público atendido" v={v(dados?.publico_atendido)} />
        </dl>
        <p className="mt-3 whitespace-pre-line text-sm text-ink/90">
          {v(dados?.descricao_atividades)}
        </p>
      </Card>

      {/* Seção 4 */}
      <Card>
        <CardTitle>4. Identificação dos riscos ocupacionais</CardTitle>

        <h3 className="mt-1 text-sm font-semibold text-ink">4.1 Riscos físicos</h3>
        <TabelaManual itens={dados?.riscos_fisicos ?? []} />

        <h3 className="mt-4 text-sm font-semibold text-ink">4.2 Riscos ergonômicos</h3>
        <TabelaManual itens={dados?.riscos_ergonomicos ?? []} />

        <h3 className="mt-4 text-sm font-semibold text-ink">4.3 Riscos psicossociais</h3>
        {riscos.length === 0 ? (
          <p className="text-xs text-ink-muted">Nenhum risco psicossocial mapeado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="px-2 py-1.5">ID</th>
                  <th className="px-2 py-1.5">Fonte</th>
                  <th className="px-2 py-1.5">Setor</th>
                  <th className="px-2 py-1.5">Sev × Prob</th>
                  <th className="px-2 py-1.5">Nível</th>
                  <th className="px-2 py-1.5">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {riscos.map((r) => {
                  const niv = nivelTxt(r.severidade, r.probabilidade);
                  return (
                    <tr key={r.id} className="border-t border-line/5">
                      <td className="px-2 py-1.5 text-ia">{r.id}</td>
                      <td className="px-2 py-1.5">{r.fonte}</td>
                      <td className="px-2 py-1.5">{r.setor}</td>
                      <td className="px-2 py-1.5">
                        {r.severidade} × {r.probabilidade}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge tone={niv.tone}>{niv.label}</Badge>
                      </td>
                      <td className="px-2 py-1.5 text-ink-muted">{r.responsavel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Seção 5 */}
      <Card>
        <CardTitle>5. Avaliação dos riscos (matriz 3×3)</CardTitle>
        <p className="mb-3 text-xs text-ink-muted">
          Probabilidade × Impacto conforme guia NR-1 e matriz Okêbambo (§4 do backlog).
        </p>
        {riscos.length === 0 ? (
          <p className="text-xs text-ink-muted">Nada a avaliar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="px-2 py-1.5">Fator</th>
                  <th className="px-2 py-1.5">Setor</th>
                  <th className="px-2 py-1.5">Probabilidade</th>
                  <th className="px-2 py-1.5">Impacto</th>
                  <th className="px-2 py-1.5">Classificação</th>
                </tr>
              </thead>
              <tbody>
                {riscos.map((r) => {
                  const niv = nivelTxt(r.severidade, r.probabilidade);
                  return (
                    <tr key={r.id} className="border-t border-line/5">
                      <td className="px-2 py-1.5">{r.fonte}</td>
                      <td className="px-2 py-1.5">{r.setor}</td>
                      <td className="px-2 py-1.5">{rotuloProb(r.probabilidade)}</td>
                      <td className="px-2 py-1.5">{rotuloImp(r.severidade)}</td>
                      <td className="px-2 py-1.5">
                        <Badge tone={niv.tone}>{niv.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Seção 6 */}
      <Card>
        <CardTitle>6. Plano de ação</CardTitle>
        {riscos.length === 0 ? (
          <p className="text-xs text-ink-muted">Nenhum plano de ação ativo nesta revisão.</p>
        ) : (
          <ul className="space-y-3">
            {riscos.map((r) => {
              const niv = nivelTxt(r.severidade, r.probabilidade);
              return (
                <li key={r.id} className="rounded-lg border border-line/5 bg-fill/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone="ia">{r.id}</Badge>
                    <span className="font-medium text-ink">{r.fonte}</span>
                    <span className="text-ink-muted">({r.setor})</span>
                    <Badge tone={niv.tone}>{niv.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{r.acao}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Responsável: {r.responsavel} · Prazo: {r.prazo}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Seção 7 */}
      <Card>
        <CardTitle>7. Monitoramento dos riscos</CardTitle>
        <p className="text-sm text-ink/90">
          Periodicidade: revisão obrigatória anual e em mudanças organizacionais relevantes.
          Gatilhos de revisão antecipada: contratação ou desligamento de mais de 10% do quadro,
          novas demandas operacionais, percepção dos profissionais (via radar ou DRPS), e
          ocorrência de protocolo de risco grave (E8). O monitoramento é contínuo via PrevIA:
          novos atendimentos atualizam o snapshot automaticamente; mudanças no snapshot invalidam
          a assinatura vigente.
        </p>
      </Card>

      {/* Seção 8 */}
      <Card>
        <CardTitle>8. Registro e documentação</CardTitle>
        <p className="mb-3 text-sm text-ink/90">
          A integridade do PGR é verificada por SHA-256 (hash do conteúdo) e por HMAC (selo da
          assinatura). Qualquer alteração nos dados Okêbambo, nos riscos ou na conformidade muda o
          hash — e exige nova assinatura.
        </p>
        <div className="rounded-xl border border-ia/25 bg-ia/[0.05] p-3 font-mono text-[11px] text-ink/80">
          <div>Hash (SHA-256): {pgr.conteudoHash}</div>
          {pgr.ultima ? (
            <div className="mt-1">Selo (HMAC): {pgr.ultima.selo}</div>
          ) : (
            <div className="mt-1 text-ink-muted">Selo: (a definir na assinatura)</div>
          )}
        </div>
      </Card>

      {/* Seção 9 */}
      <Card>
        <CardTitle>9. Responsável pela elaboração</CardTitle>
        {pgr.ultima ? (
          <dl className="grid gap-2 md:grid-cols-2">
            <KV k="Nome" v={pgr.ultima.assinante_nome} />
            <KV k="Função" v={pgr.ultima.assinante_papel} />
            <KV k="Registro" v={v(pgr.ultima.assinante_registro)} />
            <KV k="Data" v={new Date(pgr.ultima.assinado_em).toLocaleString("pt-BR")} />
          </dl>
        ) : (
          <div className="rounded-xl border border-line/10 bg-fill/[0.02] p-3">
            <p className="text-sm text-ink/90">
              Esta revisão ainda não foi assinada. Os dados que aparecem na seção 1 do responsável
              técnico são da edição em rascunho:
            </p>
            <dl className="mt-2 grid gap-2 md:grid-cols-2">
              <KV k="Nome" v={v(dados?.responsavel_tecnico_nome)} />
              <KV
                k="Registro"
                v={`${v(dados?.responsavel_tecnico_conselho)} ${v(dados?.responsavel_tecnico_registro)}`}
              />
            </dl>
          </div>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-ok" />
          A assinatura é selada com HMAC e datada — registro de responsabilidade técnica.
        </p>
      </Card>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/5 py-1.5 last:border-0">
      <dt className="text-xs text-ink-muted">{k}</dt>
      <dd className="text-right text-sm font-medium text-ink">{v}</dd>
    </div>
  );
}

function TabelaManual({
  itens,
}: {
  itens: { risco: string; fonte: string; consequencia: string }[];
}) {
  if (!itens || itens.length === 0) {
    return <p className="text-xs text-ink-muted">Nenhum risco listado.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th className="px-2 py-1.5">Risco</th>
            <th className="px-2 py-1.5">Fonte</th>
            <th className="px-2 py-1.5">Consequência</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((r, i) => (
            <tr key={i} className="border-t border-line/5">
              <td className="px-2 py-1.5">{r.risco}</td>
              <td className="px-2 py-1.5 text-ink-muted">{r.fonte}</td>
              <td className="px-2 py-1.5 text-ink-muted">{r.consequencia}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
