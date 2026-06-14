import Link from "next/link";
import {
  Inbox,
  Filter,
  CalendarDays,
  Megaphone,
  Building2,
  HeartPulse,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Database,
  FlaskConical,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { exigirSessao } from "@/lib/auth";
import { dbHabilitado } from "@/lib/db";
import {
  listarLeads,
  contarLeads,
  resumoFunil,
  STATUS_VALIDOS,
  type FiltrosLeads,
  type LeadStatus,
  type LeadTipo,
} from "@/lib/queries-leads";
import { StatusSelect } from "./_components/status-select";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<LeadTipo, string> = {
  empresa: "Empresa",
  clinica: "Clínica",
};
const TIPO_TONE: Record<LeadTipo, "ia" | "humano"> = {
  empresa: "ia",
  clinica: "humano",
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  qualificado: "Qualificado",
  convertido: "Convertido",
  perdido: "Perdido",
};

const PAGE_SIZE = 30;

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function readParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseFiltros(
  sp: Record<string, string | string[] | undefined>,
): FiltrosLeads {
  const tipoRaw = readParam(sp, "tipo");
  const statusRaw = readParam(sp, "status");
  const utm = readParam(sp, "utm_campaign");
  const since = readParam(sp, "since");
  const until = readParam(sp, "until");
  const pageRaw = readParam(sp, "page");
  const page = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1);

  const tipo: LeadTipo | undefined =
    tipoRaw === "empresa" || tipoRaw === "clinica" ? tipoRaw : undefined;
  const status: LeadStatus | undefined =
    statusRaw && (STATUS_VALIDOS as readonly string[]).includes(statusRaw)
      ? (statusRaw as LeadStatus)
      : undefined;

  return {
    tipo,
    status,
    utm_campaign: utm,
    since,
    until,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
}

/** Reconstrói querystring preservando filtros e trocando 1 param. */
function buildHref(
  base: Record<string, string | undefined>,
  trocar: Record<string, string | undefined>,
): string {
  const merged: Record<string, string | undefined> = { ...base, ...trocar };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v && v.length > 0) params.set(k, v);
  }
  const qs = params.toString();
  return `/admin/leads${qs ? `?${qs}` : ""}`;
}

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  // Gate na PÁGINA (não só layout): no App Router layout e page renderizam
  // em paralelo, então um redirect só no layout não impede o RSC payload da
  // page de ser serializado. exigirSessao lança → queries não rodam.
  exigirSessao(["admin"]);

  const filtros = parseFiltros(searchParams);
  const semDb = !dbHabilitado;

  const [leads, total, funil] = await Promise.all([
    listarLeads(filtros),
    contarLeads(filtros),
    resumoFunil(filtros),
  ]);

  // Params para preservar filtros nos links de paginação
  const baseParams: Record<string, string | undefined> = {
    tipo: filtros.tipo,
    status: filtros.status,
    utm_campaign: filtros.utm_campaign,
    since: filtros.since,
    until: filtros.until,
  };

  const pageAtual = Math.floor((filtros.offset ?? 0) / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const taxaConv =
    funil.total > 0 ? Math.round((funil.convertido / funil.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Pipeline de Leads"
        descricao="Captura cross-tenant da landing /nr1 — empresas e clínicas parceiras. Atualize o status para acompanhar a conversão."
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
      />

      {/* Cards do funil */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <FunilCard
          rotulo="Novos"
          valor={funil.novo}
          icon={<Inbox className="h-4 w-4" />}
          tone="ia"
        />
        <FunilCard
          rotulo="Contatados"
          valor={funil.contatado}
          icon={<Mail className="h-4 w-4" />}
          tone="ia"
        />
        <FunilCard
          rotulo="Qualificados"
          valor={funil.qualificado}
          icon={<Sparkles className="h-4 w-4" />}
          tone="ambar"
        />
        <FunilCard
          rotulo="Convertidos"
          valor={funil.convertido}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="ok"
          sub={funil.total > 0 ? `${taxaConv}% de conversão` : undefined}
        />
        <FunilCard
          rotulo="Perdidos"
          valor={funil.perdido}
          icon={<XCircle className="h-4 w-4" />}
          tone="neutro"
        />
      </div>

      {/* Filtros */}
      <Card>
        <CardTitle
          icon={<Filter className="h-5 w-5" />}
          hint="Combine filtros para isolar uma origem, período ou status"
          action={
            filtros.tipo ||
            filtros.status ||
            filtros.utm_campaign ||
            filtros.since ||
            filtros.until ? (
              <Link
                href="/admin/leads"
                className="text-xs text-ink-muted underline hover:text-ink"
              >
                limpar filtros
              </Link>
            ) : null
          }
        >
          Filtros
        </CardTitle>
        <form
          method="get"
          action="/admin/leads"
          className="grid gap-3 md:grid-cols-5"
          aria-label="Filtros de leads"
        >
          <CampoSelect
            label="Tipo"
            name="tipo"
            valor={filtros.tipo ?? ""}
            opcoes={[
              { v: "", l: "Todos" },
              { v: "empresa", l: "Empresa" },
              { v: "clinica", l: "Clínica" },
            ]}
          />
          <CampoSelect
            label="Status"
            name="status"
            valor={filtros.status ?? ""}
            opcoes={[
              { v: "", l: "Todos" },
              ...STATUS_VALIDOS.map((s) => ({ v: s, l: STATUS_LABEL[s] })),
            ]}
          />
          <CampoTexto
            label="utm_campaign"
            name="utm_campaign"
            valor={filtros.utm_campaign ?? ""}
            placeholder="Ex: lancamento_q1"
          />
          <CampoTexto
            label="A partir de"
            name="since"
            valor={filtros.since ?? ""}
            type="date"
          />
          <CampoTexto
            label="Até"
            name="until"
            valor={filtros.until ?? ""}
            type="date"
          />
          <div className="md:col-span-5">
            <button
              type="submit"
              className="rounded-xl bg-ia px-4 py-2 text-sm font-semibold text-onaccent shadow-glow hover:brightness-110"
            >
              Aplicar filtros
            </button>
          </div>
        </form>
      </Card>

      {/* Tabela de leads */}
      <Card>
        <CardTitle
          icon={<Inbox className="h-5 w-5" />}
          hint={`${total.toLocaleString("pt-BR")} lead(s) — exibindo ${leads.length}`}
          action={<Badge tone="neutro">página {pageAtual} / {totalPages}</Badge>}
        >
          Leads
        </CardTitle>
        {leads.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">
            Nenhum lead encontrado com os filtros atuais.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line/5">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-line/5 bg-fill/[0.02] text-left text-xs uppercase tracking-wider text-ink-muted">
                  <th scope="col" className="px-3 py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" /> Quando
                    </span>
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Tipo
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Contato
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Empresa / Clínica
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Megaphone className="h-3.5 w-3.5" /> Origem (UTM)
                    </span>
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-line/5 last:border-0 align-top transition-colors hover:bg-fill/[0.03]"
                  >
                    <td className="px-3 py-2.5 text-ink-muted">
                      {fmtData(l.criado_em)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={TIPO_TONE[l.tipo]}>
                        {l.tipo === "empresa" ? (
                          <Building2 className="h-3 w-3" />
                        ) : (
                          <HeartPulse className="h-3 w-3" />
                        )}
                        {TIPO_LABEL[l.tipo]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-ink">{l.nome}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted/80">
                        <Mail className="h-3 w-3" />
                        <a
                          href={`mailto:${l.email}`}
                          className="hover:text-ink"
                        >
                          {l.email}
                        </a>
                      </div>
                      {l.telefone && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted/80">
                          <Phone className="h-3 w-3" />
                          <span>{l.telefone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-ink/90">{l.empresa_nome ?? "—"}</div>
                      {l.cargo && (
                        <div className="text-[11px] text-ink-muted/80">
                          {l.cargo}
                        </div>
                      )}
                      {l.colaboradores != null && (
                        <div className="text-[11px] text-ink-muted/80">
                          {l.colaboradores.toLocaleString("pt-BR")} colab.
                        </div>
                      )}
                      {l.conselho && (
                        <div className="text-[11px] text-ink-muted/80">
                          {l.conselho}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.utm_campaign || l.utm_source ? (
                        <div className="space-y-0.5 text-[11px]">
                          {l.utm_campaign && (
                            <div className="text-ink/90">
                              <span className="text-ink-muted">camp:</span>{" "}
                              {l.utm_campaign}
                            </div>
                          )}
                          {l.utm_source && (
                            <div className="text-ink-muted/80">
                              <span className="text-ink-muted">src:</span>{" "}
                              {l.utm_source}
                            </div>
                          )}
                          {l.utm_medium && (
                            <div className="text-ink-muted/80">
                              <span className="text-ink-muted">med:</span>{" "}
                              {l.utm_medium}
                            </div>
                          )}
                          {l.utm_content && (
                            <div className="text-ink-muted/80 truncate max-w-[180px]">
                              <span className="text-ink-muted">ct:</span>{" "}
                              {l.utm_content}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-muted">
                          orgânico
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end">
                        <StatusSelect id={l.id} inicial={l.status} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <nav
            className="mt-4 flex items-center justify-between text-xs text-ink-muted"
            aria-label="Paginação"
          >
            <span>
              {(filtros.offset ?? 0) + 1}–
              {(filtros.offset ?? 0) + leads.length} de{" "}
              {total.toLocaleString("pt-BR")}
            </span>
            <div className="flex items-center gap-2">
              <LinkPaginacao
                href={
                  pageAtual > 1
                    ? buildHref(baseParams, {
                        page: pageAtual > 2 ? String(pageAtual - 1) : undefined,
                      })
                    : null
                }
                label="Anterior"
                icon={<ChevronLeft className="h-3.5 w-3.5" />}
              />
              <LinkPaginacao
                href={
                  pageAtual < totalPages
                    ? buildHref(baseParams, { page: String(pageAtual + 1) })
                    : null
                }
                label="Próxima"
                icon={<ChevronRight className="h-3.5 w-3.5" />}
                trailing
              />
            </div>
          </nav>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subcomponentes server                                                      */
/* -------------------------------------------------------------------------- */
function FunilCard({
  rotulo,
  valor,
  icon,
  tone,
  sub,
}: {
  rotulo: string;
  valor: number;
  icon: React.ReactNode;
  tone: "ia" | "humano" | "ok" | "ambar" | "neutro";
  sub?: string;
}) {
  const ring: Record<typeof tone, string> = {
    ia: "text-ia",
    humano: "text-humano",
    ok: "text-ok",
    ambar: "text-humano-soft",
    neutro: "text-ink-muted",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <span className={ring[tone]}>{icon}</span>
        {rotulo}
      </div>
      <div className="mt-1.5">
        <span className="stat-num">{valor.toLocaleString("pt-BR")}</span>
      </div>
      {sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}
    </Card>
  );
}

function CampoSelect({
  label,
  name,
  valor,
  opcoes,
}: {
  label: string;
  name: string;
  valor: string;
  opcoes: { v: string; l: string }[];
}) {
  return (
    <div>
      <label
        htmlFor={`f-${name}`}
        className="mb-1.5 block text-xs font-medium text-ink-muted"
      >
        {label}
      </label>
      <select
        id={`f-${name}`}
        name={name}
        defaultValue={valor}
        className="w-full rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
      >
        {opcoes.map((o) => (
          <option key={o.v || "_"} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}

function CampoTexto({
  label,
  name,
  valor,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  valor: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label
        htmlFor={`f-${name}`}
        className="mb-1.5 block text-xs font-medium text-ink-muted"
      >
        {label}
      </label>
      <input
        id={`f-${name}`}
        type={type}
        name={name}
        defaultValue={valor}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line/15 bg-fill/5 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-ia/50 focus:outline-none focus:ring-2 focus:ring-ia/20"
      />
    </div>
  );
}

function LinkPaginacao({
  href,
  label,
  icon,
  trailing,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  trailing?: boolean;
}) {
  const cls = cn(
    "inline-flex items-center gap-1 rounded-lg border border-line/10 px-2.5 py-1.5 transition-colors",
    href ? "hover:bg-fill/[0.04] hover:text-ink" : "cursor-not-allowed opacity-40",
  );
  if (!href) {
    return (
      <span className={cls} aria-disabled="true">
        {!trailing && icon}
        {label}
        {trailing && icon}
      </span>
    );
  }
  return (
    <Link href={href} className={cls}>
      {!trailing && icon}
      {label}
      {trailing && icon}
    </Link>
  );
}
