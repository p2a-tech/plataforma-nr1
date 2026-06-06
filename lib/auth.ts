import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Sessão da plataforma — token assinado (HMAC) em cookie httpOnly.
 * Suporta papéis: 'sst' (gestor/empresa), 'clinica' (parceiro), 'admin' (P2A).
 * Gate feito em server layouts (runtime Node) — não em middleware Edge.
 */

/**
 * Segredo lazy + FAIL-CLOSED: em produção, se AUTH_SECRET não estiver setado,
 * lança erro (em vez de cair num default conhecido — que tornaria sessões
 * forjáveis). Lazy para não quebrar o `next build` (NODE_ENV=production).
 */
function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET não configurada em produção (fail-closed).");
  }
  return "dev-auth-secret-trocar-em-producao";
}
export const COOKIE = "previa_session";
export const MAX_AGE = 60 * 60 * 8; // 8 horas

export type Papel = "sst" | "clinica" | "admin" | "diretoria";

export interface Sessao {
  papel: Papel;
  email: string;
  nome?: string;
  /** Preenchido para usuários de clínica; null para sst/admin. */
  clinica_id?: string | null;
  /** Empresa (cliente PrevIA) à qual o usuário pertence. */
  empresa_id: string;
  exp: number; // epoch seconds
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const deb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export function assinarSessao(p: Omit<Sessao, "exp">): string {
  const payload: Sessao = { ...p, exp: Math.floor(Date.now() / 1000) + MAX_AGE };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verificarSessao(token?: string | null): Sessao | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const esperado = createHmac("sha256", getSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(deb64url(body)) as Sessao;
    if (!p.exp || p.exp * 1000 < Date.now()) return null;
    if (!p.papel || !p.email) return null;
    return p;
  } catch {
    return null;
  }
}

/** Lê a sessão do cookie (server component / route handler). */
export function getSessao(): Sessao | null {
  return verificarSessao(cookies().get(COOKIE)?.value);
}

/**
 * Exige sessão válida (e, opcionalmente, papel permitido). Redireciona para
 * /login se não autenticado, ou para a home do papel se sem permissão.
 * Use no topo de layouts/páginas server.
 */
export function exigirSessao(papeis?: Papel[]): Sessao {
  const s = getSessao();
  if (!s) redirect("/login");
  if (papeis && !papeis.includes(s.papel)) redirect(homePorPapel(s.papel));
  return s;
}

/** Rota inicial conforme o papel. */
export function homePorPapel(papel: Papel): string {
  if (papel === "clinica") return "/atendimento";
  if (papel === "admin") return "/admin";
  if (papel === "diretoria") return "/diretoria";
  return "/dashboard";
}

/**
 * Rotas que expõem dados SST/compliance org-wide — restritas a sst|admin.
 * Um usuário 'clinica' NÃO pode ver o dashboard, riscos, PGR, conformidade,
 * escuta nem governança da empresa (separação Human-in-the-Loop: clínica só
 * opera no nível do indivíduo, via /atendimento).
 */
const ROTAS_SST: readonly string[] = [
  "/dashboard",
  "/escuta",
  "/riscos",
  "/pgr",
  "/conformidade",
  "/juridico",
  "/governanca",
];

/** True se o pathname pertence a uma área SST-only. */
export function isRotaSST(pathname: string): boolean {
  return ROTAS_SST.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

/**
 * Multi-tenancy (E5): fonte única de verdade do escopo de empresa para queries.
 * Server-only. Lança se chamada sem sessão (use após exigirSessao).
 */
export function getEmpresaIdAtiva(): string {
  const s = getSessao();
  if (!s) throw new Error("getEmpresaIdAtiva chamada sem sessão");
  return s.empresa_id;
}
