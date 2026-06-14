import { AlertOctagon, ShieldAlert, HeartHandshake, Activity } from "lucide-react";
import { Card, CardTitle, PageHeader, Badge } from "@/components/ui/primitives";
import { exigirSessao } from "@/lib/auth";
import {
  listarEventosAtivos,
  resumoSeveridade,
  type TipoRisco,
} from "@/lib/risco-grave";
import { TabelaEventos } from "./tabela";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<TipoRisco, string> = {
  ideacao_suicida: "Ideação suicida",
  violencia_iminente: "Violência iminente",
  surto_psiquico: "Surto psíquico",
  outros: "Outros",
};

const TIPO_DESCRICAO: Record<TipoRisco, string> = {
  ideacao_suicida: "Avaliar risco · CVV 188 · encaminhamento imediato",
  violencia_iminente: "Acionar segurança · proteção do trabalhador",
  surto_psiquico: "Estabilização · acolhimento clínico",
  outros: "Avaliação caso a caso pelo DPO/SST",
};

export default async function RiscoGravePage() {
  // Auth NO TOPO da page (App Router renderiza layout e page em paralelo —
  // layout-only não bloqueia). É a barreira de RBAC efetiva.
  const sessao = exigirSessao(["sst", "admin"]);
  const empresaId = sessao.empresa_id;

  const [resumo, eventos] = await Promise.all([
    resumoSeveridade(empresaId),
    listarEventosAtivos(empresaId),
  ]);

  const totalAbertos = eventos.length;
  const tiposComEvento = new Set(resumo.map((r) => r.tipo));
  const TIPOS_ORDEM: TipoRisco[] = [
    "ideacao_suicida",
    "violencia_iminente",
    "surto_psiquico",
    "outros",
  ];
  const resumoPorTipo: Record<TipoRisco, { abertos: number; em_atendimento: number; severidade_media: number }> = {
    ideacao_suicida: { abertos: 0, em_atendimento: 0, severidade_media: 0 },
    violencia_iminente: { abertos: 0, em_atendimento: 0, severidade_media: 0 },
    surto_psiquico: { abertos: 0, em_atendimento: 0, severidade_media: 0 },
    outros: { abertos: 0, em_atendimento: 0, severidade_media: 0 },
  };
  for (const r of resumo) resumoPorTipo[r.tipo] = r;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Risco grave/iminente"
        descricao="Protocolo NR-1 · eventos sinalizados pela clínica parceira. Cada evento é anônimo (marcador opaco) e exige decisão humana SST/DPO para encerramento."
        badge={
          totalAbertos > 0 ? (
            <Badge tone="alerta">
              <AlertOctagon className="h-3 w-3" /> {totalAbertos} aberto{totalAbertos === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge tone="ok">
              <ShieldAlert className="h-3 w-3" /> nenhum evento aberto
            </Badge>
          )
        }
      />

      <ProtocoloBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TIPOS_ORDEM.map((tipo) => {
          const dados = resumoPorTipo[tipo];
          const ativo = tiposComEvento.has(tipo);
          return (
            <Card key={tipo} className="p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                <AlertOctagon className={ativo ? "h-4 w-4 text-alerta" : "h-4 w-4 text-ink-muted"} />
                {TIPO_LABEL[tipo]}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="stat-num">{dados.abertos + dados.em_atendimento}</span>
                <span className="text-[11px] text-ink-muted">
                  {dados.abertos} aberto · {dados.em_atendimento} em atendimento
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                {TIPO_DESCRICAO[tipo]}
              </p>
              {dados.severidade_media > 0 && (
                <div className="mt-2 text-[11px] text-ink-muted">
                  severidade média:{" "}
                  <span className="font-medium text-ink">{dados.severidade_media.toFixed(1)}/5</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardTitle
          icon={<Activity className="h-5 w-5" />}
          hint="Apenas eventos abertos ou em atendimento. Encerrados saem desta lista — auditoria pelo log."
          action={
            <Badge tone={eventos.length === 0 ? "ok" : "alerta"}>
              {eventos.length} ativo{eventos.length === 1 ? "" : "s"}
            </Badge>
          }
        >
          Eventos ativos
        </CardTitle>

        {eventos.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Nenhum evento de risco grave/iminente aberto no momento.
          </p>
        ) : (
          <TabelaEventos
            eventos={eventos.map((e) => ({
              id: e.id,
              marcador_anonimo: e.marcador_anonimo,
              tipo: e.tipo,
              tipo_label: TIPO_LABEL[e.tipo],
              severidade: e.severidade,
              status: e.status,
              clinica_id: e.clinica_id,
              escalonado_para: e.escalonado_para,
              criado_em: e.criado_em,
            }))}
          />
        )}
      </Card>
    </div>
  );
}

function ProtocoloBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-alerta/25 bg-alerta/[0.06] p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-alerta/15 text-alerta ring-1 ring-inset ring-alerta/25">
        <HeartHandshake className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">Protocolo NR-1 · ação humana</span>
          <Badge tone="alerta">
            <AlertOctagon className="h-3 w-3" /> emergência
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          A clínica parceira reporta o evento (sem PII). A empresa registra a resposta — quem foi
          acionado, ações tomadas — e encerra. CVV: 188 · SAMU: 192. Eventos críticos exigem
          escalonamento ao DPO em até 24h.
        </p>
      </div>
    </div>
  );
}
