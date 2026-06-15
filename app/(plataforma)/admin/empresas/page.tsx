import Link from "next/link";
import {
  Building2,
  Users,
  Database,
  FlaskConical,
  Search,
  ArrowLeft,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { exigirSessao } from "@/lib/auth";
import { dbHabilitado } from "@/lib/db";
import { listarEmpresas } from "@/lib/admin-gestao";
import { NovaEmpresa } from "./_components/nova-empresa";
import { ToggleAtiva } from "./_components/toggle-ativa";

export const dynamic = "force-dynamic";

function fmtDataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function readParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminEmpresasPage({ searchParams }: PageProps) {
  // Gate na PÁGINA (não só no layout): no App Router layout+page renderizam em
  // paralelo, então o redirect do layout não impede o RSC payload da page de
  // ser serializado. exigirSessao lança → queries não rodam.
  exigirSessao(["admin"]);

  const q = readParam(searchParams, "q");
  const ativaRaw = readParam(searchParams, "ativa");
  const ativa = ativaRaw === "true" ? true : ativaRaw === "false" ? false : undefined;

  const empresas = await listarEmpresas({ q, ativa });
  const semDb = !dbHabilitado;

  const totalUsuarios = empresas.reduce((s, e) => s + e.usuarios_total, 0);
  const ativas = empresas.filter((e) => e.ativa).length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Empresas"
        descricao="Onboarding de clientes da plataforma. Cadastre, edite e ative/desative empresas (tenants)."
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
        acao={<NovaEmpresa />}
      />

      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Console Admin
      </Link>

      {/* Resumo + filtro */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <Building2 className="h-4 w-4 text-ia" /> Empresas
          </div>
          <div className="mt-1.5">
            <span className="stat-num">{empresas.length.toLocaleString("pt-BR")}</span>
          </div>
          <div className="mt-1 text-xs text-ink-muted">{ativas} ativa(s)</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <Users className="h-4 w-4 text-ia" /> Usuários (total)
          </div>
          <div className="mt-1.5">
            <span className="stat-num">{totalUsuarios.toLocaleString("pt-BR")}</span>
          </div>
          <div className="mt-1 text-xs text-ink-muted">somando todas as empresas</div>
        </Card>
        <Card className="lg:col-span-2">
          <form method="get" action="/admin/empresas" className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-ink-muted">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                <input
                  id="q"
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="nome, id ou CNPJ"
                  className="w-full rounded-xl border border-line/15 bg-fill/5 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted/70 focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
                />
              </div>
            </div>
            <div>
              <label htmlFor="ativa" className="mb-1.5 block text-xs font-medium text-ink-muted">
                Status
              </label>
              <select
                id="ativa"
                name="ativa"
                defaultValue={ativaRaw ?? ""}
                className="rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
              >
                <option value="">Todas</option>
                <option value="true">Ativas</option>
                <option value="false">Inativas</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-xl border border-line/15 bg-fill/5 px-4 py-2 text-sm font-medium text-ink hover:bg-fill/10"
            >
              Filtrar
            </button>
          </form>
        </Card>
      </div>

      {/* Tabela de empresas */}
      <Card>
        <CardTitle
          icon={<Building2 className="h-5 w-5" />}
          hint="Cada empresa é um tenant isolado (RLS). Usuários e clínicas pertencem a uma empresa."
          action={<Badge tone="neutro">{empresas.length} registro(s)</Badge>}
        >
          Empresas cadastradas
        </CardTitle>
        {empresas.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">
            {q || ativa !== undefined
              ? "Nenhuma empresa com os filtros atuais."
              : "Nenhuma empresa cadastrada. Use “Nova empresa” para começar."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line/5">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line/5 bg-fill/[0.02] text-left text-xs uppercase tracking-wider text-ink-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Empresa</th>
                  <th scope="col" className="px-3 py-2 font-medium">CNPJ</th>
                  <th scope="col" className="px-3 py-2 font-medium">Segmento</th>
                  <th scope="col" className="px-3 py-2 font-medium">Usuários</th>
                  <th scope="col" className="px-3 py-2 font-medium">Desde</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-line/5 last:border-0 transition-colors hover:bg-fill/[0.03]"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-ink">{e.nome}</div>
                      <div className="font-mono text-[11px] text-ink-muted">{e.id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-ink/80">{e.cnpj ?? "—"}</td>
                    <td className="px-3 py-2.5 text-ink/80">{e.segmento ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/usuarios?empresa_id=${encodeURIComponent(e.id)}`}
                        className="inline-flex items-center gap-1.5 text-ink hover:text-ia"
                      >
                        <Users className="h-3.5 w-3.5 text-ink-muted" />
                        {e.usuarios_total}
                        <span className="text-[11px] text-ink-muted">
                          ({e.usuarios_ativos} ativo{e.usuarios_ativos === 1 ? "" : "s"})
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{fmtDataCurta(e.criada_em)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <ToggleAtiva id={e.id} inicial={e.ativa} />
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
