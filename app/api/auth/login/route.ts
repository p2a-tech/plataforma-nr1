/**
 * POST   /api/auth/login  → login genérico (sst | clinica | admin)
 * DELETE /api/auth/login  → logout
 */
import { loginHandler, logoutHandler } from "@/lib/auth-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = loginHandler;
export const DELETE = logoutHandler;
