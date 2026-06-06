import { Database, FlaskConical } from "lucide-react";
import { PageHeader, Badge, Card } from "@/components/ui/primitives";
import { DiretoriaView } from "@/components/diretoria-view";
import { exigirSessao } from "@/lib/auth";
import { getDiretoriaOverview } from "@/lib/diretoria";

// Sempre busca no servidor (consolidado pode mudar a cada pulso).
export const dynamic = "force-dynamic";

export default async function DiretoriaPage() {
  // Acesso restrito: Diretoria (e Admin).
  exigirSessao(["diretoria", "admin"]);

  const dados = await getDiretoriaOverview();
  const temDados = dados.fonte === "db" && dados.empresas.length > 0;

  return (
    <div>
      <PageHeader
        titulo="Visão Diretoria · Grupo GPS"
        descricao="Consolidado de risco psicossocial e adesão NR-1 de todas as empresas do grupo, com visão por segmento e por empresa."
        badge={
          temDados ? (
            <Badge tone="ok">
              <Database className="mr-1 inline h-3 w-3" /> Ao vivo
            </Badge>
          ) : (
            <Badge tone="ambar">
              <FlaskConical className="mr-1 inline h-3 w-3" /> Sem dados no banco
            </Badge>
          )
        }
      />

      {temDados ? (
        <DiretoriaView empresas={dados.empresas} segmentos={dados.segmentos} />
      ) : (
        <Card className="py-16 text-center">
          <FlaskConical className="mx-auto h-10 w-10 text-ink-muted" />
          <h2 className="mt-4 font-display text-xl font-semibold text-ink">Banco de dados vazio</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Cadastre as empresas do grupo e gere micro-pulsos para popular o consolidado.
          </p>
          <code className="mt-4 inline-block rounded-lg bg-fill/5 px-3 py-1.5 text-xs text-ink-muted">
            psql -f db/seed-grupo-gps.sql
          </code>
        </Card>
      )}
    </div>
  );
}
