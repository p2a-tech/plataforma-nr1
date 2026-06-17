import {
  LayoutDashboard,
  RadioTower,
  AlertOctagon,
  ClipboardList,
  FileSignature,
  Workflow,
  HeartPulse,
  FileAudio,
  BadgeCheck,
  History,
  ShieldCheck,
  Scale,
  Inbox,
  BarChart3,
  Upload,
  Building2,
  UserCog,
  Bell,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** ator define a cor de destaque: ia = ciano, humano/clinica = laranja */
  ator: "ia" | "clinica" | "humano";
  descricao: string;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ator: "ia", descricao: "Visão SST / compliance" },
  { href: "/escuta", label: "Escuta Ativa", icon: RadioTower, ator: "ia", descricao: "Radar IA · micro-pulsos" },
  { href: "/escuta/risco-grave", label: "Risco grave/iminente", icon: AlertOctagon, ator: "humano", descricao: "Protocolo NR-1 · emergência" },
  { href: "/escuta/drps", label: "DRPS · Questionário", icon: ClipboardList, ator: "ia", descricao: "Diagnóstico psicossocial NR-1" },
  { href: "/escuta/analise", label: "DRPS · Análise", icon: BarChart3, ator: "ia", descricao: "DRPS · análise setorizada e por contrato" },
  { href: "/escuta/historico", label: "DRPS · Histórico", icon: History, ator: "ia", descricao: "Evolução das dimensões NR-1 ao longo dos ciclos" },
  { href: "/escuta/importar", label: "DRPS · Importar", icon: Upload, ator: "ia", descricao: "Importar respostas de Google Forms" },
  { href: "/riscos", label: "Inventário de Riscos", icon: ClipboardList, ator: "ia", descricao: "PGR vivo" },
  { href: "/pgr", label: "PGR · Assinatura", icon: FileSignature, ator: "ia", descricao: "Validação humana assinada" },
  { href: "/fluxo", label: "Fluxo Human-in-the-Loop", icon: Workflow, ator: "ia", descricao: "Como a parceria opera" },
  { href: "/clinica", label: "Portal da Clínica", icon: HeartPulse, ator: "clinica", descricao: "Visão do parceiro" },
  { href: "/atendimento", label: "Atendimento + IA", icon: FileAudio, ator: "clinica", descricao: "Transcrição → análise da IA" },
  { href: "/conformidade", label: "Conformidade & eSocial", icon: BadgeCheck, ator: "ia", descricao: "NR-1 · eventos" },
  { href: "/juridico", label: "Compliance Jurídico", icon: Scale, ator: "ia", descricao: "Base legal · DPIA · evidências" },
  { href: "/governanca", label: "Governança & LGPD", icon: ShieldCheck, ator: "ia", descricao: "Privacidade e ética" },
  { href: "/notificacoes", label: "Notificações", icon: Bell, ator: "ia", descricao: "Avisos · risco grave, DSAR" },
  { href: "/admin/leads", label: "Leads /nr1", icon: Inbox, ator: "ia", descricao: "Pré-venda /nr1" },
  { href: "/admin/empresas", label: "Empresas", icon: Building2, ator: "ia", descricao: "Onboarding de clientes (tenants)" },
  { href: "/admin/usuarios", label: "Usuários", icon: UserCog, ator: "ia", descricao: "Gestão de acessos por papel" },
];
