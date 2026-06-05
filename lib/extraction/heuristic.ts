import type { OfensorTag, Severidade } from "@previa/contracts";
import { OFENSORES_LABEL } from "@previa/contracts";
import { LEXICO, SINAIS_RISCO_GRAVE } from "./lexicon";
import type { ResultadoAnalise, NotaSugerida } from "./types";

/** Normaliza para casar termos sem acento/caixa. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Extrator HEURÍSTICO — roda sem nenhuma IA externa. Conta ocorrências de
 * termos do léxico, deriva confiança e severidade, e sugere notas. Determinístico
 * e auditável: o mesmo texto sempre produz o mesmo resultado.
 */
export function analisarHeuristico(transcricao: string): ResultadoAnalise {
  const texto = norm(transcricao);
  const termosNorm = LEXICO.map((regra) => ({
    tag: regra.tag,
    termos: regra.termos.map(norm),
  }));

  const contagem = new Map<OfensorTag, { hits: number; evidencia?: string }>();

  for (const regra of termosNorm) {
    let hits = 0;
    let evidencia: string | undefined;
    for (const termo of regra.termos) {
      let idx = texto.indexOf(termo);
      while (idx !== -1) {
        hits++;
        if (!evidencia) {
          // captura um trecho da transcrição ORIGINAL ao redor do match
          const ini = Math.max(0, idx - 24);
          const fim = Math.min(transcricao.length, idx + termo.length + 24);
          evidencia = "…" + transcricao.slice(ini, fim).trim() + "…";
        }
        idx = texto.indexOf(termo, idx + termo.length);
      }
    }
    if (hits > 0) contagem.set(regra.tag, { hits, evidencia });
  }

  const totalHits = [...contagem.values()].reduce((a, b) => a + b.hits, 0) || 1;

  const ofensores = [...contagem.entries()]
    .map(([tag, { hits, evidencia }]) => ({
      tag,
      // confiança cresce com hits mas satura (1 - e^-x), arredondada a 2 casas
      confidence: Math.min(0.97, Math.round((1 - Math.exp(-0.6 * hits)) * 100) / 100),
      ocorrencias: Math.min(50, hits),
      evidencia,
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const severidade = estimarSeveridade(ofensores.length, totalHits);
  const riscoGrave = SINAIS_RISCO_GRAVE.some((s) => texto.includes(norm(s)));
  const notas = montarNotas(ofensores, riscoGrave);

  return { ofensores, severidade, notas, riscoGrave, engine: "heuristico" };
}

function estimarSeveridade(nTags: number, totalHits: number): Severidade {
  const score = nTags * 2 + totalHits;
  if (score >= 14) return "critica";
  if (score >= 8) return "alta";
  if (score >= 3) return "media";
  return "baixa";
}

function montarNotas(
  ofensores: ResultadoAnalise["ofensores"],
  riscoGrave: boolean,
): NotaSugerida[] {
  const notas: NotaSugerida[] = [];

  if (riscoGrave) {
    notas.push({
      topico: "⚠ Risco grave/iminente",
      texto:
        "Sinais de risco à vida detectados na fala. Acionar protocolo de emergência e avaliação humana imediata. Não encerrar o atendimento sem encaminhamento.",
    });
  }

  if (ofensores.length === 0) {
    notas.push({
      topico: "Resumo",
      texto:
        "Sem ofensores organizacionais evidentes nesta transcrição até o momento. Seguir escuta.",
    });
    return notas;
  }

  const principais = ofensores.slice(0, 3).map((o) => OFENSORES_LABEL[o.tag]);
  notas.push({
    topico: "Temas organizacionais predominantes",
    texto: principais.join("; ") + ".",
  });

  const top = ofensores[0];
  notas.push({
    topico: "Sugestão de acolhimento",
    texto: sugestaoPorTag(top.tag),
  });

  return notas;
}

function sugestaoPorTag(tag: OfensorTag): string {
  const mapa: Partial<Record<OfensorTag, string>> = {
    sobrecarga_trabalho:
      "Validar a percepção de sobrecarga; explorar limites e estratégias de organização. No sistêmico: revisar dimensionamento de equipe.",
    ritmo_pressao_metas:
      "Acolher o impacto da pressão por metas; trabalhar autorregulação. No sistêmico: revisar política de metas.",
    conflito_lideranca:
      "Explorar a relação com a liderança sem julgamento. No sistêmico: sinalizar necessidade de capacitação de gestores.",
    jornada_descanso_insuficiente:
      "Avaliar higiene do sono e impacto da jornada. No sistêmico: revisar escalas e pausas.",
    assedio_moral:
      "Acolhimento cuidadoso; orientar sobre canais de denúncia. No sistêmico: alerta de compliance (sem identificar pessoas).",
  };
  return (
    mapa[tag] ??
    "Acolher a queixa organizacional e registrar o ofensor genérico para o lado sistêmico, sem dados identificáveis."
  );
}
