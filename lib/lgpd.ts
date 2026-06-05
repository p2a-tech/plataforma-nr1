import "server-only";
import { sql } from "@/lib/db";

/**
 * PrevIA · Retenção de dados (E7.2 / LGPD).
 *
 * Política: dados de pulso são minimizados e expirados automaticamente.
 *   - pulso_respostas: já são ANÔNIMOS (sem PII, sem id de pessoa) →
 *     descartados após RETENCAO_MESES.
 *   - pulso_sessoes: estado efêmero da conversa (telefone_hash pseudônimo);
 *     sessões "presas" são podadas após SESSOES_DIAS dias.
 *   - webhook_audit_log: log operacional → podado após RETENCAO_MESES.
 *
 * O job que aplica esta política vive em `scripts/retencao.mjs` (cron diário).
 * Esta lib é server-only e pode ser reutilizada por uma rota API se necessário.
 */

/** Janela de retenção (meses) para respostas anônimas e logs de auditoria. */
export const RETENCAO_MESES = 12;

/** Sessões de conversa abandonadas/concluídas são efêmeras: podar após N dias. */
export const SESSOES_DIAS = 30;

export type RelatorioRetencao = {
  dryRun: boolean;
  retencaoMeses: number;
  sessoesDias: number;
  contagens: {
    pulso_respostas: number;
    pulso_sessoes: number;
    webhook_audit_log: number;
  };
};

/**
 * Aplica (ou simula) a política de retenção. Retorna a contagem de linhas
 * removidas por tabela. Em `dryRun`, apenas CONTA o que SERIA removido — nada
 * é apagado.
 */
export async function aplicarRetencao({
  dryRun,
}: {
  dryRun: boolean;
}): Promise<RelatorioRetencao> {
  const corteMeses = `${RETENCAO_MESES} months`;
  const corteSessoes = `${SESSOES_DIAS} days`;

  if (dryRun) {
    const [respostas] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.pulso_respostas
      where respondido_em < now() - ${corteMeses}::interval
    `;
    const [sessoes] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.pulso_sessoes
      where atualizado_em < now() - ${corteSessoes}::interval
    `;
    const [audit] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.webhook_audit_log
      where recebido_em < now() - ${corteMeses}::interval
    `;
    return {
      dryRun,
      retencaoMeses: RETENCAO_MESES,
      sessoesDias: SESSOES_DIAS,
      contagens: {
        pulso_respostas: respostas?.n ?? 0,
        pulso_sessoes: sessoes?.n ?? 0,
        webhook_audit_log: audit?.n ?? 0,
      },
    };
  }

  // pulso_respostas já é anônimo → delete é suficiente (não há PII a anonimizar).
  const respostas = await sql`
    delete from public.pulso_respostas
    where respondido_em < now() - ${corteMeses}::interval
  `;
  const sessoes = await sql`
    delete from public.pulso_sessoes
    where atualizado_em < now() - ${corteSessoes}::interval
  `;
  const audit = await sql`
    delete from public.webhook_audit_log
    where recebido_em < now() - ${corteMeses}::interval
  `;

  return {
    dryRun,
    retencaoMeses: RETENCAO_MESES,
    sessoesDias: SESSOES_DIAS,
    contagens: {
      pulso_respostas: respostas.count,
      pulso_sessoes: sessoes.count,
      webhook_audit_log: audit.count,
    },
  };
}
