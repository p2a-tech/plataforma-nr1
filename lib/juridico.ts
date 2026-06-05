import "server-only";
import { sql, dbHabilitado } from "@/lib/db";

/**
 * Agregações específicas do Compliance Jurídico (/juridico).
 *
 * Lê dentro do escopo de empresa (RLS aplica). As funções devolvem zeros
 * seguros se o banco estiver indisponível.
 */

export interface JuridicoResumo {
  consentimentosTotal: number;
  consentimentosUltimoDia: number;
  termoVigenteVersao: string | null;
  pulsoSessoesAtivas: number;
  retencaoRespostasAcima12m: number;
  auditAceitos: number;
  auditRejeitados: number;
  ultimoEvento: string | null;
  protocoloEmergenciaContagem: number;
}

export async function getResumoJuridico(): Promise<JuridicoResumo> {
  const vazio: JuridicoResumo = {
    consentimentosTotal: 0,
    consentimentosUltimoDia: 0,
    termoVigenteVersao: null,
    pulsoSessoesAtivas: 0,
    retencaoRespostasAcima12m: 0,
    auditAceitos: 0,
    auditRejeitados: 0,
    ultimoEvento: null,
    protocoloEmergenciaContagem: 0,
  };
  if (!dbHabilitado) return vazio;
  try {
    const [r] = await sql<
      {
        consent_total: number;
        consent_24h: number;
        termo_versao: string | null;
        sessoes_ativas: number;
        retencao_velhos: number;
        audit_ok: number;
        audit_rej: number;
        ultimo_evento: string | null;
        emergencias: number;
      }[]
    >`
      select
        (select count(*)::int from public.consentimentos)                                                  as consent_total,
        (select count(*)::int from public.consentimentos where concedido_em > now() - interval '24 hours') as consent_24h,
        (select versao from public.termos_consentimento where vigente limit 1)                              as termo_versao,
        (select count(*)::int from public.pulso_sessoes)                                                    as sessoes_ativas,
        (select count(*)::int from public.pulso_respostas where respondido_em < now() - interval '12 months') as retencao_velhos,
        (select count(*)::int from public.webhook_audit_log where resultado = 'aceito')                     as audit_ok,
        (select count(*)::int from public.webhook_audit_log where resultado = 'rejeitado')                  as audit_rej,
        (select max(criado_em)::text from public.eventos_agregados)                                         as ultimo_evento,
        (select count(*)::int from public.eventos_agregados where protocolo_emergencia)                     as emergencias
    `;
    return {
      consentimentosTotal: r?.consent_total ?? 0,
      consentimentosUltimoDia: r?.consent_24h ?? 0,
      termoVigenteVersao: r?.termo_versao ?? null,
      pulsoSessoesAtivas: r?.sessoes_ativas ?? 0,
      retencaoRespostasAcima12m: r?.retencao_velhos ?? 0,
      auditAceitos: r?.audit_ok ?? 0,
      auditRejeitados: r?.audit_rej ?? 0,
      ultimoEvento: r?.ultimo_evento ?? null,
      protocoloEmergenciaContagem: r?.emergencias ?? 0,
    };
  } catch (e) {
    console.warn("[juridico] getResumoJuridico falhou:", e);
    return vazio;
  }
}
