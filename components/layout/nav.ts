import {
  LayoutDashboard,
  RadioTower,
  ClipboardList,
  FileSignature,
  Workflow,
  HeartPulse,
  FileAudio,
  BadgeCheck,
  ShieldCheck,
  Scale,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { Papel } from "@/lib/auth";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** ator define a cor de destaque: ia = ciano, clinica = laranja */
  ator: "ia" | "clinica";
  descricao: string;
  /** Se definido, item só aparece para esses papéis. Sem isso = todos veem. */
  papeis?: Papel[];
}

export const navItems: NavItem[] = [
  { href: "/diretoria", label: "Visão Diretoria", icon: Building2, ator: "ia", descricao: "Consolidado do grupo", papeis: ["diretoria", "admin"] },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ator: "ia", descricao: "Visão SST / compliance" },
  { href: "/escuta", label: "Escuta Ativa", icon: RadioTower, ator: "ia", descricao: "Radar IA · micro-pulsos" },
  { href: "/riscos", label: "Inventário de Riscos", icon: ClipboardList, ator: "ia", descricao: "PGR vivo" },
  { href: "/pgr", label: "PGR · Assinatura", icon: FileSignature, ator: "ia", descricao: "Validação humana assinada" },
  { href: "/fluxo", label: "Fluxo Human-in-the-Loop", icon: Workflow, ator: "ia", descricao: "Como a parceria opera" },
  { href: "/clinica", label: "Portal da Clínica", icon: HeartPulse, ator: "clinica", descricao: "Visão do parceiro" },
  { href: "/atendimento", label: "Atendimento + IA", icon: FileAudio, ator: "clinica", descricao: "Transcrição → análise da IA" },
  { href: "/conformidade", label: "Conformidade & eSocial", icon: BadgeCheck, ator: "ia", descricao: "NR-1 · eventos" },
  { href: "/juridico", label: "Compliance Jurídico", icon: Scale, ator: "ia", descricao: "Base legal · DPIA · evidências" },
  { href: "/governanca", label: "Governança & LGPD", icon: ShieldCheck, ator: "ia", descricao: "Privacidade e ética" },
];
