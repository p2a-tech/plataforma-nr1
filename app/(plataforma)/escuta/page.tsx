import {
  Activity,
  BarChart3,
  Clock,
  Heart,
  HeartHandshake,
  Lock,
  MessageCircle,
  Radio,
  ShieldCheck,
  Smartphone,
  Users,
  Gauge,
} from "lucide-react";
import { Card, CardTitle, PageHeader, Badge, ProgressBar } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { RespostasBarChart } from "@/components/charts";
import { cn } from "@/lib/utils";
import { conversaPulso, adesaoCanais, empresa, type BalaoChat } from "@/lib/mock-data";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import {
  getRadarResumo,
  getRadarCanais,
  getRadarRespostasSemana,
  getRadarPorSetor,
  getRadarOfensores,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EscutaPage() {
  const sessao = exigirSessao(["sst", "admin"]);
  const [resumo, canaisQ, semana, porSetor, ofensores] = await withEmpresa(
    sessao.empresa_id,
    () =>
      Promise.all([
        getRadarResumo(),
        getRadarCanais(),
        getRadarRespostasSemana(),
        getRadarPorSetor(),
        getRadarOfensores(),
      ]),
  );
  const real = resumo.fonte === "real";

  const metricas = real
    ? [
        { id: "taxa", rotulo: "Taxa de adesão", valor: String(resumo.adesao), unidade: "%", hint: "Respostas sobre convidados", icon: Radio },
        { id: "tempo", rotulo: "Tempo médio de resposta", valor: String(resumo.tempoMedio), unidade: "s", hint: "Do convite à conclusão", icon: Clock },
        { id: "respostas", rotulo: "Respostas na semana", valor: resumo.respostasSemana.toLocaleString("pt-BR"), hint: "Pulsos respondidos (7 dias)", icon: MessageCircle },
        { id: "alcance", rotulo: "Alcance", valor: resumo.alcance.toLocaleString("pt-BR"), hint: "Trabalhadores convidados", icon: Users },
      ]
    : [
        { id: "taxa", rotulo: "Taxa de adesão", valor: "—", unidade: "%", hint: "Sem dados ainda", icon: Radio },
        { id: "tempo", rotulo: "Tempo médio de resposta", valor: "—", unidade: "s", hint: "Sem dados ainda", icon: Clock },
        { id: "respostas", rotulo: "Respostas na semana", valor: "—", hint: "Sem dados ainda", icon: MessageCircle },
        { id: "alcance", rotulo: "Alcance", valor: "—", hint: "Sem dados ainda", icon: Users },
      ];

  const canais = canaisQ.fonte === "real" ? canaisQ.canais : adesaoCanais;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Escuta Ativa · Radar IA"
        descricao={`Micro-pulsos anônimos de ~30s via WhatsApp para ${empresa.nome}. Sinais agregados por cluster — nunca respostas individuais.`}
        badge={
          real ? (
            <Badge tone="ok"><Radio className="h-3 w-3" /> {resumo.totalRespostas} pulsos coletados</Badge>
          ) : (
            <Badge tone="ambar"><Radio className="h-3 w-3" /> aguardando pulsos</Badge>
          )
        }
      />

      <AnonimatoBanner />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Coluna esquerda: conversa no telefone */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-6">
            <PhoneFrame conversa={conversaPulso} />
            <p className="mt-2 text-center text-[11px] text-ink-muted">
              Exemplo do fluxo do micro-pulso (WhatsApp Cloud API). Respostas reais entram pelo webhook.
            </p>
          </div>
        </div>

        {/* Coluna direita: métricas + gráficos reais */}
        <div className="space-y-6 lg:col-span-7">
          {!real && (
            <EmptyState
              icon={<Radio className="h-7 w-7" />}
              titulo="Sem pulsos ainda"
              descricao="Quando os trabalhadores responderem aos micro-pulsos do Radar, as métricas de adesão, os sinais por setor e os fatores mais citados aparecem aqui — sempre agregados por cluster (k ≥ 7)."
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            {metricas.map((m) => (
              <Card key={m.id} className="p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                  <m.icon className="h-4 w-4 text-ia" />
                  {m.rotulo}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="stat-num">{m.valor}</span>
                  {m.unidade && <span className="text-lg font-medium text-ink-muted">{m.unidade}</span>}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{m.hint}</p>
              </Card>
            ))}
          </div>

          {/* Adesão por canal */}
          <Card>
            <CardTitle
              icon={<Smartphone className="h-5 w-5" />}
              hint="Por onde os trabalhadores respondem aos pulsos"
              action={<Badge tone={canaisQ.fonte === "real" ? "ok" : "ambar"}>{canaisQ.fonte === "real" ? "dados reais" : "demo"}</Badge>}
            >
              Distribuição por canal
            </CardTitle>
            <div className="space-y-4">
              {canais.map((c) => (
                <div key={c.canal}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-ink/85">{c.canal}</span>
                    <span className="font-medium text-ink">{c.valor}%</span>
                  </div>
                  <ProgressBar value={c.valor} tone="ia" />
                </div>
              ))}
            </div>
          </Card>

          {/* Respostas ao longo da semana */}
          <Card>
            <CardTitle
              icon={<BarChart3 className="h-5 w-5" />}
              hint="Volume de pulsos respondidos por dia (7 dias)"
              action={<Badge tone={semana.fonte === "real" ? "ok" : "ambar"}>{semana.fonte === "real" ? "dados reais" : "demo"}</Badge>}
            >
              Respostas ao longo da semana
            </CardTitle>
            <RespostasBarChart data={semana.fonte === "real" ? semana.dados : undefined} />
          </Card>

          {/* Sinais por setor (energia → risco) — k-anonymity */}
          <Card>
            <CardTitle
              icon={<Gauge className="h-5 w-5" />}
              hint="Índice de risco por setor a partir da energia reportada (clusters k≥7)"
              action={<Badge tone={porSetor.fonte === "real" ? "ok" : "ambar"}>{porSetor.fonte === "real" ? "k ≥ 7" : "demo"}</Badge>}
            >
              Sinais por setor
            </CardTitle>
            {porSetor.fonte === "real" ? (
              <div className="space-y-3.5">
                {porSetor.setores.map((s) => {
                  const atencao = s.risco >= 62;
                  return (
                    <div key={s.setor}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-ink/85">
                          {s.setor}
                          {atencao && <Badge tone="humano">Risco alto</Badge>}
                          <span className="text-[11px] text-ink-muted">{s.respostas} resp.</span>
                        </span>
                        <span className={cn("font-medium", atencao ? "text-humano" : "text-ink")}>
                          {s.risco}/100
                        </span>
                      </div>
                      <ProgressBar value={s.risco} tone={atencao ? "humano" : "ia"} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-ink-muted">
                Aguardando volume mínimo de respostas por cluster (k ≥ 7) para revelar sinais.
              </p>
            )}

            {ofensores.fonte === "real" && ofensores.ofensores.length > 0 && (
              <div className="mt-4 border-t border-line/5 pt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Fatores mais citados nos pulsos
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ofensores.ofensores.map((o) => (
                    <Badge key={o.tag} tone="ia">
                      {o.label} · {o.n}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function AnonimatoBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ia/20 bg-ia/[0.06] p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ia/15 text-ia ring-1 ring-inset ring-ia/25">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">Anônimo por desenho (k-anonymity)</span>
          <Badge tone="ia"><Lock className="h-3 w-3" /> k ≥ 7</Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          As respostas entram de forma agregada por cluster (Setor × Turno). A plataforma nunca
          exibe respostas individuais — só clusters com no mínimo 7 pessoas são revelados.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function PhoneFrame({ conversa }: { conversa: BalaoChat[] }) {
  return (
    <div className="mx-auto w-full max-w-[380px] rounded-[2.5rem] border border-line/10 bg-navy-deep p-2.5 shadow-2xl shadow-black/40">
      <div className="overflow-hidden rounded-[2rem] border border-line/5 bg-navy">
        <div className="flex items-center gap-3 border-b border-line/5 bg-navy-panel px-4 py-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-ia/15 text-ia ring-1 ring-inset ring-ia/25">
            <Heart className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink">PrevIA · Cuidado</div>
            <div className="flex items-center gap-1.5 text-[11px] text-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulseDot" />
              online · responde em 30s
            </div>
          </div>
          <ShieldCheck className="h-4 w-4 text-ink-muted" />
        </div>
        <div className="flex max-h-[560px] flex-col gap-2.5 overflow-y-auto bg-navy-deep/40 px-3 py-4">
          {conversa.map((b, i) => (
            <ChatBubble key={i} balao={b} index={i} />
          ))}
          <ConviteAcolhimento />
        </div>
        <div className="flex items-center gap-2 border-t border-line/5 bg-navy-panel px-3 py-2.5">
          <div className="flex-1 rounded-full bg-fill/5 px-4 py-2 text-xs text-ink-muted">Digite uma mensagem…</div>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-ia text-onaccent" aria-label="Enviar">
            <MessageCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ balao, index }: { balao: BalaoChat; index: number }) {
  const isBot = balao.de === "bot";
  return (
    <div
      className={cn("flex animate-fade-up", isBot ? "justify-start" : "justify-end")}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className={cn("flex max-w-[82%] flex-col", isBot ? "items-start" : "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm",
            isBot
              ? "rounded-tl-sm bg-navy-panel text-ink ring-1 ring-inset ring-line/5"
              : "rounded-tr-sm bg-emerald-700/80 text-white",
          )}
        >
          {balao.texto}
        </div>
        {isBot && balao.opcoes && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {balao.opcoes.map((op) => (
              <span key={op} className="rounded-full border border-ia/25 bg-ia/[0.08] px-2.5 py-1 text-[11px] font-medium text-ia">
                {op}
              </span>
            ))}
          </div>
        )}
        <span className="mt-1 px-1 text-[10px] text-ink-muted">{balao.hora}</span>
      </div>
    </div>
  );
}

function ConviteAcolhimento() {
  return (
    <div className="mt-1 flex animate-fade-up justify-start" style={{ animationDelay: "540ms" }}>
      <div className="flex w-full items-center gap-2.5 rounded-2xl border border-humano/25 bg-humano/[0.08] px-3.5 py-2.5">
        <HeartHandshake className="h-5 w-5 shrink-0 text-humano" />
        <span className="text-[11px] leading-relaxed text-humano-soft">
          Encaminhado em sigilo à clínica parceira · cuidado humano
        </span>
      </div>
    </div>
  );
}
