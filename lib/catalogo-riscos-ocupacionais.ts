/**
 * Catálogo estático de riscos ocupacionais FÍSICOS e ERGONÔMICOS típicos de
 * clínicas de saúde/educação (NR-9 · agentes físicos / NR-17 · ergonomia).
 *
 * Usado como "Adicionar do catálogo" na aba 4.1/4.2 do formulário do PGR
 * Okêbambo (Onda 8). Cada item entra como {risco, fonte, consequencia} nos
 * arrays jsonb `pgr_revisao.riscos_fisicos` / `riscos_ergonomicos`.
 *
 * Não tem RLS (catálogo global, igual a `catalogo-atividades-clinicas`,
 * `dim_nr1` e `fator_nr1`). PT-BR em todo o conteúdo.
 *
 * Referências: NR-9 (avaliação e controle de agentes físicos/químicos/
 * biológicos) e NR-17 (ergonomia — mobiliário, posto de trabalho, esforço).
 */

export type CategoriaRiscoOcupacional = "fisico" | "ergonomico";

export interface RiscoOcupacionalCatalogo {
  /** chave estável (kebab-case) usada em logs/sugestões. */
  key: string;
  /** físico (NR-9) ou ergonômico (NR-17). */
  categoria: CategoriaRiscoOcupacional;
  /** nome do risco — vai para o campo `risco`. */
  risco: string;
  /** fonte geradora — vai para o campo `fonte`. */
  fonte: string;
  /** consequência possível à saúde — vai para o campo `consequencia`. */
  consequencia: string;
}

export const RISCOS_OCUPACIONAIS: RiscoOcupacionalCatalogo[] = [
  /* ───────────────── Riscos físicos (NR-9) ───────────────── */
  {
    key: "ruido-ambiental",
    categoria: "fisico",
    risco: "Ruído ambiental",
    fonte: "Movimentação de pacientes, choro de crianças e conversas simultâneas nas salas de atendimento",
    consequencia: "Desconcentração, fadiga auditiva, irritabilidade e estresse ao longo da jornada",
  },
  {
    key: "iluminacao-inadequada",
    categoria: "fisico",
    risco: "Iluminação inadequada",
    fonte: "Salas de atendimento, avaliação e administração com luminância insuficiente ou ofuscante",
    consequencia: "Fadiga visual, cefaleia e maior esforço durante leitura e aplicação de testes",
  },
  {
    key: "temperatura-ventilacao",
    categoria: "fisico",
    risco: "Temperatura e ventilação inadequadas",
    fonte: "Climatização deficiente, ambientes fechados e baixa renovação de ar nas salas",
    consequencia: "Desconforto térmico, queda de produtividade e desconforto respiratório",
  },
  {
    key: "agentes-biologicos",
    categoria: "fisico",
    risco: "Agentes biológicos (exposição básica)",
    fonte: "Contato próximo com pacientes, secreções e superfícies em atendimentos presenciais",
    consequencia: "Risco de contágio de doenças infectocontagiosas (gripes, viroses) entre profissionais e pacientes",
  },
  {
    key: "eletricidade-fios",
    categoria: "fisico",
    risco: "Choque elétrico / fios expostos",
    fonte: "Tomadas sobrecarregadas, extensões e fios de equipamentos terapêuticos e de informática",
    consequencia: "Risco de choque elétrico, queimaduras e princípios de incêndio",
  },
  {
    key: "umidade-mofo",
    categoria: "fisico",
    risco: "Umidade e mofo",
    fonte: "Infiltrações, banheiros e copas com ventilação deficiente e limpeza inadequada",
    consequencia: "Agravamento de alergias e doenças respiratórias; desconforto no ambiente",
  },

  /* ───────────────── Riscos ergonômicos (NR-17) ───────────────── */
  {
    key: "postura-sentada-prolongada",
    categoria: "ergonomico",
    risco: "Postura sentada prolongada",
    fonte: "Atendimentos, avaliações e devolutivas realizados sentado por longos períodos sem pausas",
    consequencia: "Dores musculares na coluna e pescoço, desconforto lombar e fadiga",
  },
  {
    key: "mobiliario-inadequado",
    categoria: "ergonomico",
    risco: "Mobiliário inadequado",
    fonte: "Cadeiras e mesas sem regulagem de altura/encosto e postos de trabalho não ajustáveis",
    consequencia: "Postura forçada, dores musculoesqueléticas e tensão cervical/lombar",
  },
  {
    key: "esforco-repetitivo-digitacao",
    categoria: "ergonomico",
    risco: "Esforço repetitivo (digitação)",
    fonte: "Registro de prontuários, laudos e relatórios em computador de forma repetitiva",
    consequencia: "LER/DORT, tendinite e dores em punhos, mãos e antebraços",
  },
  {
    key: "levantamento-pacientes-criancas",
    categoria: "ergonomico",
    risco: "Levantamento e manuseio de pacientes/crianças",
    fonte: "Apoio à locomoção, posicionamento em macas/tatames e manejo de crianças nos atendimentos",
    consequencia: "Lombalgia, lesões na coluna e sobrecarga musculoesquelética",
  },
  {
    key: "postura-em-pe-prolongada",
    categoria: "ergonomico",
    risco: "Postura em pé prolongada",
    fonte: "Atividades de fisioterapia, terapia ocupacional e dinâmicas em grupo realizadas de pé",
    consequencia: "Fadiga em membros inferiores, varizes e dores nas pernas e costas",
  },
  {
    key: "trabalho-tela-iluminacao",
    categoria: "ergonomico",
    risco: "Trabalho prolongado com telas",
    fonte: "Uso contínuo de monitores e telas em teleatendimento e tarefas administrativas",
    consequencia: "Fadiga visual, ressecamento ocular e tensão na musculatura do pescoço e ombros",
  },
];

/** Todos os itens do catálogo (cópia rasa para evitar mutação externa). */
export function todos(): RiscoOcupacionalCatalogo[] {
  return [...RISCOS_OCUPACIONAIS];
}

/** Filtra os itens de uma categoria ('fisico' | 'ergonomico'). */
export function listarPorCategoria(
  categoria: CategoriaRiscoOcupacional,
): RiscoOcupacionalCatalogo[] {
  return RISCOS_OCUPACIONAIS.filter((r) => r.categoria === categoria);
}

/** Lookup rápido por key. */
export function riscoPorKey(key: string): RiscoOcupacionalCatalogo | undefined {
  return RISCOS_OCUPACIONAIS.find((r) => r.key === key);
}
