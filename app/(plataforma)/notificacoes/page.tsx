import { Bell, Database, FlaskConical } from "lucide-react";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { exigirSessao } from "@/lib/auth";
import { dbHabilitado } from "@/lib/db";
import {
  listarNotificacoes,
  contarNaoLidas,
  type Notificacao,
} from "@/lib/notificacoes";
import { ListaNotificacoes } from "./_components/lista-notificacoes";

export const dynamic = "force-dynamic";

/**
 * Painel de notificações in-app (Onda 8 · Dev A). Fecha o loop: a tabela
 * `notificacoes` (escrita por lib/notify.ts) finalmente é LIDA e exibida.
 *
 * Gate sst|admin no TOPO da própria page (App Router renderiza layout+page em
 * paralelo, então o gate do layout não basta).
 */
export default async function NotificacoesPage() {
  const sessao = exigirSessao(["sst", "admin"]);

  // Filtros de tipo conforme o papel (admin vê reset_senha; sst não).
  const filtrosTipo: { valor: "" | Notificacao["tipo"]; label: string }[] =
    sessao.papel === "admin"
      ? [
          { valor: "", label: "Todos os tipos" },
          { valor: "risco_grave", label: "Risco grave" },
          { valor: "dsar", label: "DSAR" },
          { valor: "reset_senha", label: "Reset de senha" },
          { valor: "generico", label: "Avisos" },
        ]
      : [
          { valor: "", label: "Todos os tipos" },
          { valor: "risco_grave", label: "Risco grave" },
          { valor: "dsar", label: "DSAR" },
          { valor: "generico", label: "Avisos" },
        ];

  if (!dbHabilitado) {
    return (
      <div className="space-y-6">
        <PageHeader
          titulo="Notificações"
          descricao="Alertas de risco grave, pedidos de DSAR e avisos da plataforma."
          badge={
            <Badge tone="ambar">
              <FlaskConical className="h-3 w-3" /> Banco indisponível
            </Badge>
          }
        />
        <EmptyState
          icon={<Bell className="h-7 w-7" />}
          titulo="Notificações indisponíveis"
          descricao="O banco de dados não está acessível agora. Tente novamente em instantes."
        />
      </div>
    );
  }

  // Carrega o estado inicial no servidor (escopo por empresa aplicado na lib).
  const [notificacoes, naoLidas] = await Promise.all([
    listarNotificacoes({
      empresaId: sessao.empresa_id,
      papel: sessao.papel,
      limit: 100,
    }),
    contarNaoLidas(sessao.empresa_id, sessao.papel),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Notificações"
        descricao="Alertas de risco grave, pedidos de DSAR e avisos da plataforma. Tudo o que exige atenção da SST, num só lugar."
        badge={
          <Badge tone="ok">
            <Database className="h-3 w-3" /> Dados reais
          </Badge>
        }
      />

      <ListaNotificacoes
        inicial={notificacoes}
        naoLidasInicial={naoLidas}
        filtrosTipo={filtrosTipo}
      />
    </div>
  );
}
