import { Upload } from "lucide-react";
import { PageHeader, Card, CardTitle, Badge } from "@/components/ui/primitives";
import { exigirSessao } from "@/lib/auth";
import { listarInstrumentosAtivos } from "@/lib/drps";
import { listarCampanhas } from "@/lib/drps-campanha";
import { ImportadorCliente } from "./cliente";

export const dynamic = "force-dynamic";

/**
 * Página · Importar respostas DRPS (Google Forms CSV).
 *
 * Onda 5 · Dev C · §9 BACKLOG_OKEBAMBO.
 *
 * Reduz fricção de adoção em clínicas pequenas que já operam o DRPS via
 * Google Forms — basta exportar o CSV e mapear as colunas no preview.
 * UI faz dry-run obrigatório antes da gravação real.
 */
export default async function ImportarPage() {
  // Auth NO TOPO (App Router renderiza layout em paralelo).
  const sessao = exigirSessao(["sst", "admin"]);
  const empresaId = sessao.empresa_id;

  const [instrumentos, campanhas] = await Promise.all([
    listarInstrumentosAtivos(empresaId),
    // Campanhas ativas pra o seletor (opcional na importação)
    listarCampanhas(empresaId, { ativos: true, limit: 50 }).catch(() => []),
  ]);

  // Pré-seleciona o template Okêbambo se existir
  const padrao =
    instrumentos.find((i) => i.codigo === "okebambo_v1") ?? instrumentos[0];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Importar respostas (Google Forms)"
        descricao="Importe um CSV exportado do Google Forms para popular o DRPS. O sistema sugere o mapeamento de colunas e permite pré-visualizar antes de gravar."
        badge={
          <Badge tone="ia">
            <Upload className="h-3 w-3" /> §9 NR-1 · idempotente
          </Badge>
        }
      />

      {instrumentos.length === 0 ? (
        <Card>
          <CardTitle icon={<Upload className="h-5 w-5" />}>
            Nenhum instrumento ativo
          </CardTitle>
          <p className="py-4 text-sm text-ink-muted">
            Você precisa de pelo menos um instrumento DRPS ativo para importar
            respostas. O template global <code>okebambo_v1</code> deveria estar
            disponível por padrão — contate o suporte.
          </p>
        </Card>
      ) : (
        <ImportadorCliente
          instrumentos={instrumentos.map((i) => ({
            id: i.id,
            codigo: i.codigo,
            titulo: i.titulo,
          }))}
          campanhas={campanhas.map((c) => ({
            id: c.id,
            codigo: c.codigo,
            titulo: c.titulo,
            ciclo: c.ciclo,
          }))}
          instrumentoPadraoId={padrao?.id ?? null}
        />
      )}

      <Card>
        <CardTitle hint="Boas práticas para importações limpas.">
          Dicas
        </CardTitle>
        <ul className="space-y-2 text-sm text-ink-muted">
          <li>
            <strong className="text-ink/85">CSV do Google Forms:</strong> em
            “Respostas → Vincular ao Sheets → exportar como CSV”. Mantenha
            o cabeçalho original (primeira linha).
          </li>
          <li>
            <strong className="text-ink/85">Mapeamento automático:</strong> o
            sistema reconhece os títulos das 21 perguntas Okêbambo (Q1..Q21).
            Revise antes de pré-visualizar — colunas “Carimbo de data/hora” e
            “E-mail” são ignoradas automaticamente.
          </li>
          <li>
            <strong className="text-ink/85">Pré-visualize sempre:</strong> use
            o botão “Pré-visualizar” (dry-run) antes de “Importar”. Dry-run
            não grava nada, só conta sucessos e erros.
          </li>
          <li>
            <strong className="text-ink/85">Idempotente:</strong> rodar a
            mesma importação 2× não duplica respostas — o marcador anônimo é
            derivado deterministicamente do conteúdo da linha.
          </li>
        </ul>
      </Card>
    </div>
  );
}
