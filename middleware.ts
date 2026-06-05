import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers em todas as respostas (E4.3). Roda no Edge — só manipula
 * headers, sem dependências de Node. O gate de autenticação fica nos layouts
 * server (runtime Node), não aqui.
 */

// CSP pragmática: permite o que o Next precisa (inline styles/scripts, next/font
// self-hosted) sem abrir para terceiros. Sem frames externos; sem objetos.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export function middleware(req: NextRequest) {
  // Propaga o pathname para os Server Components (layouts) via header de request,
  // permitindo gate de RBAC por rota sem reestruturar pastas. (E6 RBAC)
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  return res;
}

export const config = {
  // Aplica a tudo, exceto assets estáticos do Next e arquivos públicos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
