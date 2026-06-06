import {
  ShieldCheck,
  Lock,
  Fingerprint,
  FileLock2,
  ArrowUpRight,
} from "lucide-react";
import { Card, PageHeader, Badge } from "@/components/ui/primitives";
import { RadarRings } from "@/components/brand/radar-rings";
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";
import { getSessao, exigirSessao } from "@/lib/auth";
import { togglesGovernanca } from "@/lib/mock-data";
import { TogglesGovernanca, type ItemGovernanca } from "./toggles";

export const dynamic = "force-dynamic";

const trustPills = [
  { icon: ShieldCheck, label: "Conforme LGPD" },
  { icon: Fingerprint, label: "k-anonymity (k≥7)" },
  { icon: FileLock2, label: "Sigilo clínico inviolável" },
  { icon: Lock, label: "Criptografia ponta a ponta" },
];

/** Mock ordenado (críticos primeiro) — formato idêntico ao das linhas reais. */
function mockOrdenado(): ItemGovernanca[] {
  return [...togglesGovernanca]
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      ativo: t.ativo,
      critico: Boolean(t.critico),
    }))
    .sort((a, b) => Number(b.critico) - Number(a.critico));
}

/** Lê a config real (críticos primeiro); cai para o mock se sem banco/vazio/erro. */
async function carregarConfig(): Promise<ItemGovernanca[]> {
  if (!dbHabilitado) return mockOrdenado();
  try {
    const rows = await sql<ItemGovernanca[]>`
      select id, titulo, descricao, ativo, critico
      from public.config_governanca
      order by critico desc, titulo asc
    `;
    return rows.length > 0 ? rows : mockOrdenado();
  } catch (e) {
    console.error("[governanca/page] erro ao ler config", e);
    return mockOrdenado();
  }
}

export default async function GovernancaPage() {
  exigirSessao(["sst", "admin", "diretoria"]);
  const sessao = getSessao();
  const podeEditar = sessao?.papel === "sst" || sessao?.papel === "admin";
  const itens = await carregarConfig();

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Governança & LGPD"
        descricao="Os controles que tornam o cuidado possível sem expor ninguém. Privacidade por design, não por promessa."
        badge={
          <Badge tone="ia">
            <ShieldCheck className="h-3 w-3" /> Privacidade por design
          </Badge>
        }
      />

      {/* Hero de governança */}
      <Card className="relative overflow-hidden border-line/8 bg-gradient-to-br from-navy-panel via-navy-panel to-ia/[0.04] p-7">
        <RadarRings className="pointer-events-none absolute -right-16 -top-20 opacity-[0.18]" />
        <div className="relative max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-ia">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              Fundação de confiança
            </span>
          </div>
          <h2 className="font-display text-2xl font-semibold leading-snug tracking-tight text-ink md:text-3xl">
            A PrevIA é construída sobre anonimato real, consentimento e sigilo
            clínico inviolável.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Toda escuta acontece de forma anônima e agregada por cluster
            (k-anonymity). O trabalhador consente antes de qualquer interação, e
            o conteúdo clínico jamais é acessado pela plataforma. A conformidade
            com a LGPD é uma propriedade da arquitetura — não um termo de uso.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {trustPills.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center gap-2 rounded-full border border-ia/20 bg-ia/[0.07] px-3.5 py-1.5 text-xs font-medium text-ia"
              >
                <p.icon className="h-3.5 w-3.5" />
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* Controles interativos (estado real, persiste via API) */}
      <TogglesGovernanca initial={itens} podeEditar={podeEditar} />

      {/* Rodapé */}
      <p className="flex items-center justify-center gap-2 pb-2 pt-1 text-center text-xs text-ink-muted">
        <ArrowUpRight className="h-3.5 w-3.5" />
        {podeEditar
          ? "Alterações são persistidas e registram autor e horário (auditável)."
          : "Visualização — somente Gestor SST/Admin pode alterar os controles."}
      </p>
    </div>
  );
}
