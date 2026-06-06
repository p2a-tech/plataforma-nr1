/**
 * ============================================================================
 *  PrevIA · DADOS SIMULADOS (MOCK)
 * ============================================================================
 *  Este é o ÚNICO lugar para editar os dados do preview. Todas as telas leem
 *  daqui. Nada é buscado de backend — é tudo estático/simulado no frontend.
 *
 *  Dica para a apresentação: ajuste nomes de empresa, setores e números aqui
 *  para refletir a realidade da clínica/empresa parceira antes da reunião.
 * ----------------------------------------------------------------------------
 *  Convenção de cor por responsabilidade:
 *    IA / plataforma  -> ciano (#00C2D1)
 *    Cuidado humano / clínica -> laranja (#FF6B35)
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/*  Marca                                                                      */
/* -------------------------------------------------------------------------- */
export const brand = {
  name: "GPSPrevIA",
  tagline: "O Ecossistema Omni-SST",
  maker: "P2A Tech",
  grupo: "Grupo GPS",
};

/* -------------------------------------------------------------------------- */
/*  Perfis de acesso (seletor no header / login)                              */
/* -------------------------------------------------------------------------- */
export type ProfileId = "sst" | "clinica" | "admin" | "diretoria";

export interface Profile {
  id: ProfileId;
  nome: string;
  papel: string;
  iniciais: string;
}

export const profiles: Profile[] = [
  { id: "sst", nome: "Marina Alves", papel: "Gestora SST · Eng. de Segurança", iniciais: "MA" },
  { id: "clinica", nome: "Dr. Rafael Nunes", papel: "Clínica Parceira · Psicólogo", iniciais: "RN" },
  { id: "diretoria", nome: "Diretoria GPS", papel: "Diretoria · Visão do grupo", iniciais: "DG" },
  { id: "admin", nome: "Admin P2A", papel: "Administrador da Plataforma", iniciais: "AP" },
];

/* -------------------------------------------------------------------------- */
/*  Empresa monitorada (cliente da plataforma)                                */
/* -------------------------------------------------------------------------- */
export const empresa = {
  nome: "Translog Brasil S.A.",
  cnpj: "12.345.678/0001-90",
  segmento: "Logística e Transporte",
  vidasMonitoradas: 2480,
  unidades: 7,
  desde: "Maio/2026",
};

/* -------------------------------------------------------------------------- */
/*  Métricas-chave do Dashboard                                               */
/*  trend: variação vs. período anterior (em pontos percentuais ou %)         */
/* -------------------------------------------------------------------------- */
export type Tendencia = "up" | "down" | "flat";

export interface Metrica {
  id: string;
  rotulo: string;
  valor: string;
  unidade?: string;
  trend: Tendencia;
  trendLabel: string;
  /** "bom" = trend favorável (verde), "ruim" = desfavorável (vermelho) */
  trendSentido: "bom" | "ruim" | "neutro";
  hint: string;
}

export const metricas: Metrica[] = [
  {
    id: "vidas",
    rotulo: "Vidas monitoradas",
    valor: "2.480",
    trend: "up",
    trendLabel: "+120 no mês",
    trendSentido: "neutro",
    hint: "Trabalhadores cobertos pelo Radar de escuta ativa.",
  },
  {
    id: "adesao",
    rotulo: "Adesão aos pulsos",
    valor: "78",
    unidade: "%",
    trend: "up",
    trendLabel: "+6 p.p.",
    trendSentido: "bom",
    hint: "% dos convidados que responderam ao micro-pulso (30s).",
  },
  {
    id: "alertas",
    rotulo: "Alertas de risco abertos",
    valor: "5",
    trend: "down",
    trendLabel: "-2 vs. semana",
    trendSentido: "bom",
    hint: "Clusters com sinal de esgotamento acima do limiar.",
  },
  {
    id: "pgr",
    rotulo: "Conformidade do PGR",
    valor: "92",
    unidade: "%",
    trend: "up",
    trendLabel: "+8 p.p.",
    trendSentido: "bom",
    hint: "Itens do PGR psicossocial atualizados e validados.",
  },
  {
    id: "absenteismo",
    rotulo: "Absenteísmo (saúde mental)",
    valor: "3,1",
    unidade: "%",
    trend: "down",
    trendLabel: "-0,7 p.p.",
    trendSentido: "bom",
    hint: "Afastamentos relacionados a transtornos · tendência de queda.",
  },
  {
    id: "fap",
    rotulo: "Projeção FAP",
    valor: "0,92",
    trend: "down",
    trendLabel: "redução de custo",
    trendSentido: "bom",
    hint: "Fator Acidentário de Prevenção projetado — abaixo de 1,0 reduz contribuição.",
  },
];

/* -------------------------------------------------------------------------- */
/*  Mapa de calor: índice de risco psicossocial por SETOR × TURNO             */
/*  valor de 0 (verde/baixo) a 100 (vermelho/crítico)                         */
/* -------------------------------------------------------------------------- */
export const turnos = ["Manhã", "Tarde", "Noite", "Madrugada"] as const;

export interface LinhaHeatmap {
  setor: string;
  valores: number[]; // alinhado a `turnos`
}

export const heatmap: LinhaHeatmap[] = [
  { setor: "Logística", valores: [38, 44, 81, 88] },
  { setor: "Atendimento (SAC)", valores: [62, 71, 54, 22] },
  { setor: "Produção", valores: [41, 49, 66, 58] },
  { setor: "Administrativo", valores: [24, 28, 18, 12] },
  { setor: "Manutenção", valores: [33, 39, 52, 61] },
  { setor: "Comercial", valores: [47, 58, 35, 14] },
];

/* -------------------------------------------------------------------------- */
/*  Série temporal: evolução do índice de risco × adesão (últimos meses)      */
/* -------------------------------------------------------------------------- */
export interface PontoSerie {
  mes: string;
  risco: number; // índice 0-100 (menor é melhor)
  adesao: number; // % de adesão aos pulsos
}

export const serieRisco: PontoSerie[] = [
  { mes: "Dez", risco: 64, adesao: 52 },
  { mes: "Jan", risco: 61, adesao: 58 },
  { mes: "Fev", risco: 59, adesao: 63 },
  { mes: "Mar", risco: 55, adesao: 67 },
  { mes: "Abr", risco: 49, adesao: 72 },
  { mes: "Mai", risco: 44, adesao: 78 },
];

/* -------------------------------------------------------------------------- */
/*  Alertas preditivos (IA)                                                    */
/* -------------------------------------------------------------------------- */
export type Severidade = "critico" | "alto" | "medio" | "baixo";

export interface Alerta {
  id: string;
  titulo: string;
  cluster: string; // sempre agregado: "Setor X · Turno Y · Site Z"
  severidade: Severidade;
  variacao: string;
  descricao: string;
  desde: string;
}

export const alertas: Alerta[] = [
  {
    id: "al-01",
    titulo: "Risco de burnout em alta",
    cluster: "Logística noturna · Site SP-03",
    severidade: "critico",
    variacao: "+34% em 14 dias",
    descricao:
      "Queda de humor e sinais de exaustão acima do limiar no cluster. Sobrecarga e ritmo de trabalho como ofensores prováveis.",
    desde: "há 2 dias",
  },
  {
    id: "al-02",
    titulo: "Tensão com liderança",
    cluster: "Atendimento (SAC) · Turno tarde",
    severidade: "alto",
    variacao: "+18% em 7 dias",
    descricao:
      "Indicadores de conflito de liderança e baixa autonomia. Recomenda-se ação organizacional.",
    desde: "há 4 dias",
  },
  {
    id: "al-03",
    titulo: "Fadiga acumulada",
    cluster: "Manutenção · Madrugada · Site RJ-01",
    severidade: "alto",
    variacao: "+12% em 10 dias",
    descricao: "Jornada e descanso insuficiente sinalizados de forma recorrente.",
    desde: "há 5 dias",
  },
  {
    id: "al-04",
    titulo: "Clima em observação",
    cluster: "Produção · Turno noite",
    severidade: "medio",
    variacao: "+6% em 14 dias",
    descricao: "Leve elevação de estresse. Monitorando evolução do cluster.",
    desde: "há 1 semana",
  },
  {
    id: "al-05",
    titulo: "Sinal pontual",
    cluster: "Comercial · Turno tarde",
    severidade: "baixo",
    variacao: "estável",
    descricao: "Variação dentro do esperado. Sem ação imediata.",
    desde: "há 3 dias",
  },
];

/* -------------------------------------------------------------------------- */
/*  Status do PGR (documento vivo)                                            */
/* -------------------------------------------------------------------------- */
export const statusPGR = {
  versao: "v4.2",
  conformidade: 92,
  ultimaAtualizacao: "Hoje, 08:14 · automática pela IA",
  validadoPor: "Pendente: assinatura do Eng. de Segurança",
  pendencias: [
    "Validar plano de ação do cluster Logística noturna (SP-03)",
    "Assinar revisão do inventário de riscos psicossociais",
    "Anexar evidência da ação de redução de jornada (Manutenção)",
  ],
};

/* -------------------------------------------------------------------------- */
/*  ESCUTA ATIVA · mockup de conversa do micro-pulso (WhatsApp)               */
/* -------------------------------------------------------------------------- */
export type Lado = "bot" | "user";

export interface BalaoChat {
  de: Lado;
  texto: string;
  hora: string;
  opcoes?: string[]; // botões de resposta rápida
}

export const conversaPulso: BalaoChat[] = [
  {
    de: "bot",
    texto:
      "Oi! 👋 Aqui é o cuidado PrevIA da Translog. São 30 segundos, anônimo e só pra saber como você está. Tudo bem responder agora?",
    hora: "09:02",
    opcoes: ["Pode ser 🙂", "Agora não"],
  },
  { de: "user", texto: "Pode ser 🙂", hora: "09:02" },
  {
    de: "bot",
    texto: "Como tem sido sua energia para o trabalho nesta semana?",
    hora: "09:02",
    opcoes: ["😀 Ótima", "🙂 Boa", "😐 Mais ou menos", "😟 Baixa", "😩 No limite"],
  },
  { de: "user", texto: "😟 Baixa", hora: "09:03" },
  {
    de: "bot",
    texto: "Obrigado por compartilhar. O que mais tem pesado ultimamente?",
    hora: "09:03",
    opcoes: ["Carga de trabalho", "Ritmo/pressão", "Relação com liderança", "Cansaço/sono", "Prefiro não dizer"],
  },
  { de: "user", texto: "Carga de trabalho", hora: "09:03" },
  {
    de: "bot",
    texto:
      "Recebido 💙 Suas respostas entram de forma anônima e agregada — ninguém vê individualmente. Se quiser, posso te conectar, em sigilo, a um psicólogo parceiro, sem custo.",
    hora: "09:03",
    opcoes: ["Quero conversar", "Agora não, obrigado"],
  },
  { de: "user", texto: "Quero conversar", hora: "09:04" },
  {
    de: "bot",
    texto:
      "Perfeito. Vou te passar para a clínica parceira com total sigilo. A partir daqui, é só entre você e o profissional. 🧡",
    hora: "09:04",
  },
];

/** Adesão por canal */
export const adesaoCanais = [
  { canal: "WhatsApp", valor: 78 },
  { canal: "App interno", valor: 14 },
  { canal: "Totem/QR", valor: 8 },
];

/** Respostas ao longo da semana (volume) */
export const respostasSemana = [
  { dia: "Seg", respostas: 312 },
  { dia: "Ter", respostas: 348 },
  { dia: "Qua", respostas: 401 },
  { dia: "Qui", respostas: 377 },
  { dia: "Sex", respostas: 420 },
  { dia: "Sáb", respostas: 188 },
  { dia: "Dom", respostas: 96 },
];

/** Adesão por setor (para barras) */
export const adesaoSetores = [
  { setor: "Administrativo", valor: 91 },
  { setor: "Comercial", valor: 84 },
  { setor: "Produção", valor: 76 },
  { setor: "Atendimento", valor: 72 },
  { setor: "Manutenção", valor: 69 },
  { setor: "Logística", valor: 61 },
];

/* -------------------------------------------------------------------------- */
/*  INVENTÁRIO DE RISCOS PSICOSSOCIAIS (PGR vivo)                             */
/*  Fonte do risco = organização do trabalho (NR-1)                           */
/* -------------------------------------------------------------------------- */
export interface Risco {
  id: string;
  fonte: string; // ofensor organizacional
  setor: string;
  severidade: 1 | 2 | 3 | 4 | 5; // impacto
  probabilidade: 1 | 2 | 3 | 4 | 5; // frequência
  acao: string;
  responsavel: string;
  prazo: string;
  status: "em-andamento" | "planejado" | "concluido" | "atrasado";
}

export const inventarioRiscos: Risco[] = [
  {
    id: "R-001",
    fonte: "Sobrecarga e ritmo de trabalho",
    setor: "Logística noturna · SP-03",
    severidade: 5,
    probabilidade: 4,
    acao: "Redimensionar escala e adicionar pausas; revisão de metas noturnas.",
    responsavel: "Coord. Logística",
    prazo: "10/06/2026",
    status: "em-andamento",
  },
  {
    id: "R-002",
    fonte: "Conflito de liderança / baixa autonomia",
    setor: "Atendimento (SAC)",
    severidade: 4,
    probabilidade: 4,
    acao: "Treinamento de liderança e canal de feedback estruturado.",
    responsavel: "RH · Desenvolvimento",
    prazo: "22/06/2026",
    status: "planejado",
  },
  {
    id: "R-003",
    fonte: "Jornada e descanso insuficiente",
    setor: "Manutenção · Madrugada",
    severidade: 4,
    probabilidade: 3,
    acao: "Ajuste de turnos e monitoramento de fadiga.",
    responsavel: "SESMT",
    prazo: "05/06/2026",
    status: "atrasado",
  },
  {
    id: "R-004",
    fonte: "Assédio/pressão por metas",
    setor: "Comercial",
    severidade: 3,
    probabilidade: 2,
    acao: "Revisão de política de metas e campanha de canal de denúncia.",
    responsavel: "Compliance",
    prazo: "30/06/2026",
    status: "planejado",
  },
  {
    id: "R-005",
    fonte: "Monotonia / falta de reconhecimento",
    setor: "Produção",
    severidade: 2,
    probabilidade: 3,
    acao: "Programa de reconhecimento e rotação de funções.",
    responsavel: "Gestão de Produção",
    prazo: "15/07/2026",
    status: "em-andamento",
  },
  {
    id: "R-006",
    fonte: "Insegurança sobre mudanças",
    setor: "Administrativo",
    severidade: 2,
    probabilidade: 2,
    acao: "Plano de comunicação interna sobre reestruturação.",
    responsavel: "Comunicação",
    prazo: "28/06/2026",
    status: "concluido",
  },
];

/* -------------------------------------------------------------------------- */
/*  FLUXO HUMAN-IN-THE-LOOP (4 passos)                                        */
/* -------------------------------------------------------------------------- */
export type AtorFluxo = "ia" | "clinica";

export interface PassoFluxo {
  n: number;
  titulo: string;
  ator: AtorFluxo;
  resumo: string;
  detalhes: string[];
}

export const fluxoPassos: PassoFluxo[] = [
  {
    n: 1,
    titulo: "Radar (IA)",
    ator: "ia",
    resumo: "Micro-pulsos anônimos de ~30s via WhatsApp detectam sinais por setor/turno.",
    detalhes: [
      "Escuta contínua e não-invasiva",
      "Sinais agregados por cluster (Setor X / Turno Y)",
      "Detecção precoce de esgotamento",
    ],
  },
  {
    n: 2,
    titulo: "Acolhimento (Clínica)",
    ator: "clinica",
    resumo: "A IA convida, em sigilo, o trabalhador para a telemedicina parceira.",
    detalhes: [
      "Convite voluntário e confidencial",
      "Encaminhamento qualificado",
      "Sem custo para o trabalhador",
    ],
  },
  {
    n: 3,
    titulo: "Sigilo clínico (Clínica)",
    ator: "clinica",
    resumo: "O psicólogo cuida do indivíduo. Conteúdo da sessão é inviolável.",
    detalhes: [
      "Cuidado humano (nível NR-7)",
      "A IA nunca acessa conteúdo clínico",
      "Barreira de sigilo intransponível",
    ],
  },
  {
    n: 4,
    titulo: "Compliance (IA)",
    ator: "ia",
    resumo: "A clínica devolve só dados agregados e anônimos; a IA atualiza o PGR/GRO.",
    detalhes: [
      "Apenas ofensores organizacionais genéricos",
      "k-anonymity garantida",
      "PGR atualizado · validação humana assinada",
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  PORTAL DA CLÍNICA PARCEIRA                                                */
/* -------------------------------------------------------------------------- */
/** Funil de pacientes encaminhados pela IA */
export const funilClinica = [
  { etapa: "Convidados pela IA", valor: 312 },
  { etapa: "Aceitaram acolhimento", valor: 196 },
  { etapa: "Primeira consulta", valor: 148 },
  { etapa: "Em acompanhamento", valor: 103 },
];

export interface Agendamento {
  hora: string;
  paciente: string; // pseudonimizado
  tipo: string;
  status: "confirmado" | "aguardando" | "concluido";
}

export const agendaClinica: Agendamento[] = [
  { hora: "08:30", paciente: "Paciente #A19F", tipo: "Acolhimento inicial", status: "concluido" },
  { hora: "09:30", paciente: "Paciente #C204", tipo: "Sessão de acompanhamento", status: "concluido" },
  { hora: "11:00", paciente: "Paciente #7B3D", tipo: "Acolhimento inicial", status: "confirmado" },
  { hora: "14:00", paciente: "Paciente #E51A", tipo: "Sessão de acompanhamento", status: "confirmado" },
  { hora: "15:30", paciente: "Paciente #9F8C", tipo: "Acolhimento inicial", status: "aguardando" },
  { hora: "16:30", paciente: "Paciente #2D77", tipo: "Sessão de acompanhamento", status: "aguardando" },
];

/** Ofensores organizacionais genéricos que o psicólogo "tagueia" (sem PII) */
export const ofensoresTags = [
  { tag: "Sobrecarga de trabalho", count: 41 },
  { tag: "Conflito de liderança", count: 28 },
  { tag: "Ritmo/pressão por metas", count: 24 },
  { tag: "Jornada/descanso", count: 19 },
  { tag: "Falta de reconhecimento", count: 13 },
  { tag: "Insegurança no emprego", count: 9 },
  { tag: "Assédio moral", count: 6 },
];

/** Indicadores B2B da clínica */
export const indicadoresClinica = [
  { id: "mrr", rotulo: "Receita recorrente (MRR)", valor: "R$ 84,2 mil", trend: "up" as Tendencia, trendLabel: "+11% no mês" },
  { id: "atend", rotulo: "Atendimentos no mês", valor: "412", trend: "up" as Tendencia, trendLabel: "+38 vs. mês anterior" },
  { id: "ocup", rotulo: "Taxa de ocupação da agenda", valor: "87%", trend: "up" as Tendencia, trendLabel: "+5 p.p." },
  { id: "nps", rotulo: "NPS dos atendimentos", valor: "72", trend: "flat" as Tendencia, trendLabel: "estável" },
];

/* -------------------------------------------------------------------------- */
/*  CONFORMIDADE & eSOCIAL                                                    */
/* -------------------------------------------------------------------------- */
export interface ItemChecklist {
  item: string;
  descricao: string;
  status: "ok" | "pendente" | "atencao";
}

export const checklistNR1: ItemChecklist[] = [
  { item: "Inventário de riscos psicossociais", descricao: "Riscos mapeados por fonte organizacional.", status: "ok" },
  { item: "PGR contempla riscos psicossociais", descricao: "Documento vivo, atualizado pela IA.", status: "ok" },
  { item: "Plano de ação com responsáveis e prazos", descricao: "Ações vinculadas a cada risco.", status: "ok" },
  { item: "Evidências de escuta ativa", descricao: "Registro anônimo e agregado dos pulsos.", status: "ok" },
  { item: "Protocolo de risco grave/iminente", descricao: "Fluxo de emergência definido e testado.", status: "ok" },
  { item: "Assinatura do responsável técnico (SESMT)", descricao: "Validação humana da revisão atual.", status: "pendente" },
  { item: "Treinamento de lideranças", descricao: "Capacitação em fatores psicossociais.", status: "atencao" },
];

export interface EventoESocial {
  codigo: string;
  nome: string;
  status: "enviado" | "pendente" | "processando";
  quantidade: number;
  ultimo: string;
}

export const eventosESocial: EventoESocial[] = [
  { codigo: "S-2210", nome: "Comunicação de Acidente de Trabalho (CAT)", status: "enviado", quantidade: 2, ultimo: "21/05/2026" },
  { codigo: "S-2220", nome: "Monitoramento da Saúde do Trabalhador (ASO)", status: "enviado", quantidade: 1840, ultimo: "26/05/2026" },
  { codigo: "S-2240", nome: "Condições Ambientais — Agentes Nocivos", status: "processando", quantidade: 312, ultimo: "27/05/2026" },
];

/** Trilha de auditoria — "quebra do nexo causal": escuta -> cuidado -> ação */
export interface EventoAuditoria {
  data: string;
  fase: "Escuta" | "Cuidado" | "Ação" | "Compliance";
  ator: AtorFluxo;
  descricao: string;
}

export const trilhaAuditoria: EventoAuditoria[] = [
  { data: "12/05 09:03", fase: "Escuta", ator: "ia", descricao: "Sinal de sobrecarga detectado — cluster Logística noturna SP-03 (anônimo)." },
  { data: "12/05 09:04", fase: "Cuidado", ator: "clinica", descricao: "Convite de acolhimento enviado em sigilo; aceite voluntário registrado." },
  { data: "13/05 14:00", fase: "Cuidado", ator: "clinica", descricao: "Acolhimento realizado. Ofensor genérico tagueado: 'sobrecarga'. Sem PII." },
  { data: "14/05 08:14", fase: "Ação", ator: "ia", descricao: "Plano de ação criado: redimensionar escala noturna. Responsável atribuído." },
  { data: "20/05 17:30", fase: "Compliance", ator: "ia", descricao: "PGR atualizado (v4.2). Evidência anexada. Aguardando assinatura do SESMT." },
];

/* -------------------------------------------------------------------------- */
/*  GOVERNANÇA & LGPD (toggles ilustrativos)                                  */
/* -------------------------------------------------------------------------- */
export interface Toggle {
  id: string;
  titulo: string;
  descricao: string;
  ativo: boolean;
  critico?: boolean;
}

export const togglesGovernanca: Toggle[] = [
  {
    id: "k-anon",
    titulo: "Anonimização (k-anonymity)",
    descricao: "Só exibe clusters com tamanho mínimo (k≥7). Nunca respostas individuais.",
    ativo: true,
    critico: true,
  },
  {
    id: "consent",
    titulo: "Consentimento explícito",
    descricao: "Trabalhador consente antes de qualquer pulso ou encaminhamento.",
    ativo: true,
    critico: true,
  },
  {
    id: "sigilo",
    titulo: "Barreira de sigilo clínico",
    descricao: "A plataforma nunca acessa conteúdo das sessões. Inviolável.",
    ativo: true,
    critico: true,
  },
  {
    id: "api",
    titulo: "Integração via API/Webhook com a clínica",
    descricao: "Troca apenas dados agregados e anônimos (ofensores genéricos).",
    ativo: true,
  },
  {
    id: "retencao",
    titulo: "Política de retenção de dados",
    descricao: "Dados de pulsos retidos por 12 meses e então anonimizados em definitivo.",
    ativo: true,
  },
  {
    id: "risco-grave",
    titulo: "Protocolo de risco grave/iminente",
    descricao: "Aciona fluxo humano de emergência imediatamente. Exceção ao anonimato.",
    ativo: true,
    critico: true,
  },
];

/* -------------------------------------------------------------------------- */
/*  Cores utilitárias para severidade / status (usadas em várias telas)       */
/* -------------------------------------------------------------------------- */
export const corSeveridade: Record<Severidade, { bg: string; text: string; dot: string; label: string }> = {
  critico: { bg: "bg-alerta/15", text: "text-alerta", dot: "bg-alerta", label: "Crítico" },
  alto: { bg: "bg-humano/15", text: "text-humano", dot: "bg-humano", label: "Alto" },
  medio: { bg: "bg-humano-soft/15", text: "text-humano-soft", dot: "bg-humano-soft", label: "Médio" },
  baixo: { bg: "bg-ia/15", text: "text-ia", dot: "bg-ia", label: "Baixo" },
};
