FROM node:24-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/
RUN npm install -g pnpm@11 && pnpm install --frozen-lockfile

FROM node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app .
RUN pnpm build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=127.0.0.1
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
RUN if [ ! -f server.js ] && [ -f apps/web/server.js ]; then ln -s apps/web/server.js server.js; fi
EXPOSE 3000
CMD ["node", "server.js"]
