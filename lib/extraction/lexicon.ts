import type { OfensorTag } from "@previa/contracts";

/**
 * Léxico pt-BR → ofensor organizacional canônico (NR-1).
 *
 * Usado pelo extrator HEURÍSTICO (fallback sem IA). Cada tag tem um conjunto
 * de termos/expressões que, ao aparecerem na transcrição, contam como sinal
 * daquele ofensor. É propositalmente conservador e auditável — nada de
 * inferência mágica: é só correspondência de termos do mundo do trabalho.
 *
 * IMPORTANTE: isto NÃO é diagnóstico. Mapeia FALAS sobre a organização do
 * trabalho para a taxonomia de risco organizacional. O conteúdo clínico
 * (sintomas, história pessoal) é deliberadamente ignorado aqui.
 */

export interface RegraLexico {
  tag: OfensorTag;
  termos: string[];
}

export const LEXICO: RegraLexico[] = [
  {
    tag: "sobrecarga_trabalho",
    termos: [
      "sobrecarga",
      "sobrecarregad",
      "muito trabalho",
      "trabalho demais",
      "acumul",
      "não dou conta",
      "nao dou conta",
      "não consigo dar conta",
      "volume de trabalho",
      "excesso de tarefa",
      "fazer hora extra",
      "horas extras",
      "trabalhando demais",
    ],
  },
  {
    tag: "ritmo_pressao_metas",
    termos: [
      "pressão",
      "pressao",
      "meta",
      "metas",
      "cobrança",
      "cobranca",
      "ritmo",
      "correria",
      "prazo apertado",
      "prazos",
      "tem que ser pra ontem",
      "produtividade",
      "bater meta",
    ],
  },
  {
    tag: "conflito_lideranca",
    termos: [
      "chefe",
      "gerente",
      "supervisor",
      "líder",
      "lider",
      "liderança",
      "lideranca",
      "gestor",
      "encarregado",
      "conflito com",
      "grosseiro",
      "humilha",
      "não escuta",
      "nao escuta",
      "autoritár",
      "microgerenc",
    ],
  },
  {
    tag: "jornada_descanso_insuficiente",
    termos: [
      "não durmo",
      "nao durmo",
      "sem dormir",
      "cansaço",
      "cansaco",
      "exaust",
      "esgotad",
      "sem pausa",
      "sem descanso",
      "virada de noite",
      "turno da noite",
      "madrugada",
      "dobrar turno",
      "folga",
      "não tenho folga",
    ],
  },
  {
    tag: "falta_reconhecimento",
    termos: [
      "não reconhec",
      "nao reconhec",
      "sem reconhecimento",
      "ninguém valoriza",
      "ninguem valoriza",
      "não sou valorizad",
      "esforço não",
      "nunca um elogio",
      "passad pra trás",
      "injust",
      "sem promoção",
      "sem promocao",
    ],
  },
  {
    tag: "inseguranca_emprego",
    termos: [
      "medo de perder o emprego",
      "demissão",
      "demissao",
      "demitir",
      "mandar embora",
      "corte",
      "reestrutur",
      "instabilidade",
      "contrato",
      "vão me mandar",
      "vao me mandar",
    ],
  },
  {
    tag: "assedio_moral",
    termos: [
      "assédio",
      "assedio",
      "humilhação",
      "humilhacao",
      "constrange",
      "gritar comigo",
      "grita comigo",
      "ameaça",
      "ameaca",
      "perseguição",
      "perseguicao",
      "exposição",
      "xinga",
    ],
  },
  {
    tag: "monotonia_falta_autonomia",
    termos: [
      "repetitiv",
      "monóton",
      "monoton",
      "sempre a mesma coisa",
      "não posso decidir",
      "nao posso decidir",
      "sem autonomia",
      "engessad",
      "tédio",
      "tedio",
      "máquina",
      "maquina",
    ],
  },
  {
    tag: "isolamento_apoio_social",
    termos: [
      "sozinho",
      "isolad",
      "sem apoio",
      "ninguém me ajuda",
      "ninguem me ajuda",
      "sem equipe",
      "não tenho com quem",
      "nao tenho com quem",
      "afastad dos colegas",
    ],
  },
  {
    tag: "ambiguidade_de_papel",
    termos: [
      "não sei o que esperam",
      "nao sei o que esperam",
      "função confusa",
      "funcao confusa",
      "ordens contraditórias",
      "ordens contraditorias",
      "cada hora uma coisa",
      "não sei minha função",
      "papel mal definido",
      "ninguém explica",
      "ninguem explica",
    ],
  },
  {
    tag: "violencia_terceiros",
    termos: [
      "cliente agressivo",
      "agredid",
      "assalt",
      "violência",
      "violencia",
      "ameaçad por cliente",
      "ameacad por cliente",
      "passageiro agressivo",
      "público agressivo",
      "publico agressivo",
    ],
  },
];

/**
 * Sinais de RISCO GRAVE/IMINENTE — única exceção ao anonimato (NR-1/protocolo
 * de emergência). Se qualquer um aparecer, a tela deve sugerir acionamento
 * humano imediato. NÃO classifica nem diagnostica — apenas levanta a bandeira
 * para decisão humana.
 */
export const SINAIS_RISCO_GRAVE: string[] = [
  "me matar",
  "tirar minha vida",
  "não quero mais viver",
  "nao quero mais viver",
  "acabar com tudo",
  "suicíd",
  "suicid",
  "me machucar",
  "sumir pra sempre",
  "não aguento mais viver",
  "nao aguento mais viver",
  "pensando em morrer",
];
