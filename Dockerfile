FROM node:24-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/
RUN npm install -g pnpm@11.13.1 && pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p apps/web/public && pnpm build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Compose binds only 127.0.0.1 on the host and attaches this shared network
# namespace exclusively to an internal Docker network.
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
RUN if [ ! -f server.js ] && [ -f apps/web/server.js ]; then ln -s apps/web/server.js server.js; fi
EXPOSE 3000
CMD ["node", "server.js"]
