/**
 * Compat: /api/auth/clinica (login/logout) — agora delega ao handler genérico.
 * Mantido para não quebrar a tela /login-clinica e a barra de sessão existentes.
 */
import { loginHandler, logoutHandler } from "@/lib/auth-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = loginHandler;
export const DELETE = logoutHandler;
