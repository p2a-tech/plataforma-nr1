/**
 * Catálogo estático de atividades clínicas — usado como autocomplete no campo
 * "descrição_atividades" da seção 3 do PGR Okêbambo.
 *
 * Fonte: material real da Clínica Okêbambo (CNPJ 54.413.743/0001-12) + ampliações
 * típicas de clínicas multiprofissionais brasileiras. Onda 4 / §6 do backlog.
 *
 * Não tem RLS (catálogo global, igual a `dim_nr1` e `fator_nr1`).
 */

export interface AtividadeClinica {
  /** chave estável usada em logs/seed (kebab-case). */
  key: string;
  /** rótulo exibido no UI / impresso no PDF. */
  label: string;
  /** descrição expandida — vai pro campo "descricao_atividades" do PGR. */
  descricao: string;
  /** área associada (ajuda a sugerir cargos/profissionais relacionados). */
  area:
    | "atendimento_clinico"
    | "avaliacao"
    | "orientacao"
    | "recurso_terapeutico"
    | "ensino_supervisao";
}

export const ATIVIDADES_CLINICAS: AtividadeClinica[] = [
  {
    key: "atendimento_psicologico",
    label: "Atendimentos psicológicos",
    descricao:
      "Atendimentos psicológicos individuais e em grupo para crianças, adolescentes, adultos e famílias.",
    area: "atendimento_clinico",
  },
  {
    key: "atendimento_psicopedagogico",
    label: "Atendimentos psicopedagógicos",
    descricao:
      "Atendimentos psicopedagógicos para investigação e intervenção em dificuldades de aprendizagem.",
    area: "atendimento_clinico",
  },
  {
    key: "atendimento_fonoaudiologico",
    label: "Atendimentos fonoaudiológicos",
    descricao:
      "Atendimentos fonoaudiológicos para distúrbios de fala, linguagem, voz, audição e deglutição.",
    area: "atendimento_clinico",
  },
  {
    key: "terapia_ocupacional",
    label: "Terapia ocupacional",
    descricao:
      "Atendimentos de terapia ocupacional para desenvolvimento de habilidades e integração sensorial.",
    area: "atendimento_clinico",
  },
  {
    key: "fisioterapia",
    label: "Fisioterapia",
    descricao:
      "Atendimentos fisioterapêuticos para reabilitação motora e prevenção de incapacidades.",
    area: "atendimento_clinico",
  },
  {
    key: "avaliacao_psicologica",
    label: "Avaliação psicológica",
    descricao:
      "Aplicação, correção e devolução de avaliações psicológicas (testes psicométricos, entrevistas e laudos).",
    area: "avaliacao",
  },
  {
    key: "orientacao_familias",
    label: "Orientação a famílias",
    descricao:
      "Orientações sistemáticas a famílias e cuidadores, alinhadas ao plano terapêutico individual.",
    area: "orientacao",
  },
  {
    key: "confeccao_recursos_terapeuticos",
    label: "Confecção artesanal de recursos terapêuticos",
    descricao:
      "Confecção artesanal de recursos pedagógicos e terapêuticos personalizados para os atendimentos.",
    area: "recurso_terapeutico",
  },
  {
    key: "treinamentos",
    label: "Treinamentos",
    descricao:
      "Treinamentos internos e externos sobre temas clínicos, gestão de equipe e saúde mental.",
    area: "ensino_supervisao",
  },
  {
    key: "supervisao_clinica",
    label: "Supervisão clínica",
    descricao:
      "Reuniões de supervisão clínica entre profissionais para discussão de casos e desenvolvimento técnico.",
    area: "ensino_supervisao",
  },
];

/** Lookup rápido por key. */
export function atividadePorKey(key: string): AtividadeClinica | undefined {
  return ATIVIDADES_CLINICAS.find((a) => a.key === key);
}

/** Apenas os labels (autocomplete simples). */
export function labelsAtividades(): string[] {
  return ATIVIDADES_CLINICAS.map((a) => a.label);
}

/** Concatena vários labels com `; ` para preview do campo descricao_atividades. */
export function descricaoPadrao(keys: string[]): string {
  return keys
    .map(atividadePorKey)
    .filter((a): a is AtividadeClinica => Boolean(a))
    .map((a) => a.descricao)
    .join(" ");
}
