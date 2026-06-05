# syntax=docker/dockerfile:1
# ============================================================================
#  PrevIA · imagem de produção (Next.js 14 standalone)
#  Multi-stage: deps -> build -> runner (slim, non-root).
#  Build:  docker build -t previa-app .
#  Run:    via docker-compose.prod.yml (serviço `app`).
# ============================================================================

# ---- Base ------------------------------------------------------------------
FROM node:20-alpine AS base
# libc6-compat ajuda binários nativos (ex.: alguns deps Node) no Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- Deps: instala dependências com cache de layer -------------------------
FROM base AS deps
# Copiamos manifests do root e do workspace para o npm resolver o monorepo.
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/package.json
# Lockfile existe -> npm ci (instalação reprodutível, inclui devDeps p/ build).
RUN npm ci

# ---- Build: gera o standalone ----------------------------------------------
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
# node_modules do workspace (symlink/dir) já vem junto via npm workspaces.
COPY . .
RUN npm run build
# Garante que /app/public exista (o projeto pode não ter assets estáticos),
# para que o COPY no estágio runner nunca falhe.
RUN mkdir -p /app/public

# ---- Runner: imagem final mínima -------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# server.js do standalone escuta em HOSTNAME:PORT.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário não-root (nextjs:nodejs).
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone traz só o necessário (server.js + node_modules tracejados).
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
# Assets estáticos e public NÃO entram no standalone — copiar à parte.
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Healthcheck bate na rota /api/health (servida pelo próprio app).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
