import Link from "next/link";
import {
  Users,
  Database,
  FlaskConical,
  Search,
  ArrowLeft,
  Building2,
  HeartPulse,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { exigirSessao } from "@/lib/auth";
import { dbHabilitado } from "@/lib/db";
import {
  listarUsuarios,
  listarEmpresas,
  listarClinicas,
  PAPEIS_VALIDOS,
  type Papel,
} from "@/lib/admin-gestao";
import { NovoUsuario } from "./_components/novo-usuario";
import { AcoesUsuario } from "./_components/acoes-usuario";

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

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function readParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function AdminUsuariosPage({ searchParams }: PageProps) {
  // Gate na PÁGINA (não só no layout) — App Router renderiza layout+page em
  // paralelo. exigirSessao lança → queries não rodam para não-admin.
  exigirSessao(["admin"]);

  const empresaFiltro = readParam(searchParams, "empresa_id");
  const papelRaw = readParam(searchParams, "papel");
  const papel = (PAPEIS_VALIDOS as readonly string[]).includes(papelRaw ?? "")
    ? (papelRaw as Papel)
    : undefined;
  const q = readParam(searchParams, "q");

  const [usuarios, empresas, clinicas] = await Promise.all([
    listarUsuarios({ empresa_id: empresaFiltro, papel, q }),
    listarEmpresas(),
    listarClinicas(),
  ]);

  const semDb = !dbHabilitado;
  const empresaOpcoes = empresas.map((e) => ({ id: e.id, nome: e.nome }));
  const clinicaOpcoes = clinicas.map((c) => ({ id: c.id, nome: c.nome, empresa_id: c.empresa_id }));
  const temFiltro = Boolean(empresaFiltro || papel || q);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Usuários"
        descricao="Gestão de acessos à plataforma. Crie usuários, defina papel/empresa e ative/desative ou redefina senha."
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
          <NovoUsuario
            empresas={empresaOpcoes}
            clinicas={clinicaOpcoes}
            empresaPadrao={empresaFiltro}
          />
        }
      />

      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Console Admin
      </Link>

      {/* Filtros */}
      <Card>
        <CardTitle
          icon={<Search className="h-5 w-5" />}
          action={
            temFiltro ? (
              <Link href="/admin/usuarios" className="text-xs text-ink-muted underline hover:text-ink">
                limpar filtros
              </Link>
            ) : null
          }
        >
          Filtros
        </CardTitle>
        <form method="get" action="/admin/usuarios" className="grid gap-3 md:grid-cols-4">
          <div>
            <label htmlFor="f-empresa" className="mb-1.5 block text-xs font-medium text-ink-muted">
              Empresa
            </label>
            <select
              id="f-empresa"
              name="empresa_id"
              defaultValue={empresaFiltro ?? ""}
              className="w-full rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
            >
              <option value="">Todas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-papel" className="mb-1.5 block text-xs font-medium text-ink-muted">
              Papel
            </label>
            <select
              id="f-papel"
              name="papel"
              defaultValue={papel ?? ""}
              className="w-full rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
            >
              <option value="">Todos</option>
              {PAPEIS_VALIDOS.map((p) => (
                <option key={p} value={p}>
                  {PAPEL_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-q" className="mb-1.5 block text-xs font-medium text-ink-muted">
              Buscar
            </label>
            <input
              id="f-q"
              name="q"
              defaultValue={q ?? ""}
              placeholder="nome ou e-mail"
              className="w-full rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-xl bg-ia px-4 py-2 text-sm font-semibold text-onaccent shadow-glow hover:brightness-110"
            >
              Aplicar
            </button>
          </div>
        </form>
      </Card>

      {/* Tabela */}
      <Card>
        <CardTitle
          icon={<Users className="h-5 w-5" />}
          hint="Acessos por papel. Papel Clínica exige clínica associada na mesma empresa."
          action={<Badge tone="neutro">{usuarios.length} usuário(s)</Badge>}
        >
          Usuários
        </CardTitle>
        {empresas.length === 0 && (
          <p className="mb-3 rounded-xl border border-humano-soft/20 bg-humano-soft/[0.04] px-3 py-2 text-xs text-humano-soft">
            Nenhuma empresa cadastrada ainda.{" "}
            <Link href="/admin/empresas" className="underline">
              Cadastre uma empresa
            </Link>{" "}
            antes de criar usuários.
          </p>
        )}
        {usuarios.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">
            {temFiltro
              ? "Nenhum usuário com os filtros atuais."
              : "Nenhum usuário cadastrado. Use “Novo usuário” para começar."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line/5">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line/5 bg-fill/[0.02] text-left text-xs uppercase tracking-wider text-ink-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Usuário</th>
                  <th scope="col" className="px-3 py-2 font-medium">Papel</th>
                  <th scope="col" className="px-3 py-2 font-medium">Empresa</th>
                  <th scope="col" className="px-3 py-2 font-medium">Clínica</th>
                  <th scope="col" className="px-3 py-2 font-medium">Desde</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr
                    key={u.email}
                    className="border-b border-line/5 last:border-0 align-top transition-colors hover:bg-fill/[0.03]"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-ink">{u.nome ?? u.email}</div>
                      <div className="text-[11px] text-ink-muted">{u.email}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={PAPEL_TONE[u.papel] ?? "neutro"}>
                        {PAPEL_LABEL[u.papel] ?? u.papel}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-ink/90">
                        <Building2 className="h-3.5 w-3.5 text-ink-muted" />
                        {u.empresa_nome ?? u.empresa_id}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {u.clinica_id ? (
                        <div className="flex items-center gap-1.5 text-ink/90">
                          <HeartPulse className="h-3.5 w-3.5 text-humano" />
                          {u.clinica_nome ?? u.clinica_id}
                        </div>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{fmtData(u.criado_em)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <AcoesUsuario email={u.email} ativo={u.ativo} />
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
