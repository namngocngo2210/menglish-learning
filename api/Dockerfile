# syntax=docker/dockerfile:1
# Build context is the REPOSITORY ROOT. Bundles the Fastify server (dist/server/main.mjs), the CLI
# (dist/main.mjs: migrate, import, parity, export-snapshot) into single files; the runtime image holds
# no node_modules.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY worker/package.json worker/
COPY packages/core/package.json packages/core/
COPY packages/data/package.json packages/data/
COPY packages/db-types/package.json packages/db-types/
RUN npm ci --workspace @bj/api --workspace @bj/worker --include-workspace-root=false

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY api ./api
COPY worker ./worker
COPY crawler/src ./crawler/src
COPY crawler/config ./crawler/config
RUN npm run build --workspace @bj/api && npm run build --workspace @bj/worker

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production MIGRATIONS_DIR=/app/db/migrations
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
COPY --from=build --chown=app:app /app/api/dist ./dist
COPY --from=build --chown=app:app /app/worker/dist/main.mjs ./dist/worker/main.mjs
COPY --chown=app:app crawler/ocr ./crawler/ocr
COPY --chown=app:app db/migrations ./db/migrations
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
CMD ["node", "--max-old-space-size=96", "--max-semi-space-size=2", "dist/server/main.mjs"]
