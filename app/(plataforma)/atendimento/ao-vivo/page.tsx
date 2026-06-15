import { exigirSessao } from "@/lib/auth";
import { liveKitConfigurado } from "@/lib/livekit";
import { PageHeader, Badge, Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { Video, Lock, Settings } from "lucide-react";
import { SalaAoVivo } from "./sala";

/**
 * Teleconsulta ao vivo (vídeo) — papel clinica|admin.
 *
 * `exigirSessao` no TOPO da própria page (App Router renderiza layout+page em
 * paralelo). É síncrono (só lê cookie). O layout de /atendimento já gateia também,
 * mas reforçamos aqui conforme convenção do projeto.
 *
 * Degrada com aviso claro se a teleconsulta não estiver configurada (LIVEKIT_*).
 * Production-shaped: assim que as envs entram, a videochamada funciona.
 */

export const dynamic = "force-dynamic";

export default function AoVivoPage() {
  exigirSessao(["clinica", "admin"]);

  if (!liveKitConfigurado) {
    return (
      <div className="space-y-6">
        <PageHeader
          titulo="Teleconsulta ao vivo"
          descricao="Videochamada com o trabalhador, transcrição ao vivo e análise por IA ao encerrar — tudo dentro do perímetro da clínica."
          badge={
            <Badge tone="humano">
              <Video className="h-3 w-3" /> Vídeo
            </Badge>
          }
        />
        <EmptyState
          icon={<Settings className="h-7 w-7" />}
          titulo="Configure a teleconsulta (LIVEKIT_*)"
          descricao="Defina LIVEKIT_API_KEY, LIVEKIT_API_SECRET e LIVEKIT_URL (wss://…) no ambiente. Assim que as três variáveis estiverem presentes, a videochamada por WebRTC fica disponível aqui — sem mexer no código."
        />
        <Card className="text-sm text-ink-muted">
          <div className="mb-2 font-display text-base font-semibold text-ink">
            Como habilitar
          </div>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Crie um projeto LiveKit (Cloud ou self-hosted) e copie a{" "}
              <span className="text-ink">API key</span>, o{" "}
              <span className="text-ink">API secret</span> e a{" "}
              <span className="text-ink">URL</span> (formato{" "}
              <code className="rounded bg-fill/5 px-1 text-ia">wss://seu-projeto.livekit.cloud</code>).
            </li>
            <li>
              No ambiente (Dokploy / .env), defina{" "}
              <code className="rounded bg-fill/5 px-1 text-ia">LIVEKIT_API_KEY</code>,{" "}
              <code className="rounded bg-fill/5 px-1 text-ia">LIVEKIT_API_SECRET</code> e{" "}
              <code className="rounded bg-fill/5 px-1 text-ia">LIVEKIT_URL</code>.
            </li>
            <li>Reinicie a aplicação. Esta tela passa a abrir a sala de vídeo.</li>
          </ol>
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-humano/10 px-3 py-2 text-xs text-humano">
            <Lock className="h-4 w-4 shrink-0" />
            A transcrição roda no navegador (Web Speech API) e nunca cruza a barreira —
            só o agregado anônimo (ofensores + severidade) é enviado ao sistêmico ao encerrar.
          </p>
        </Card>
      </div>
    );
  }

  return <SalaAoVivo />;
}
