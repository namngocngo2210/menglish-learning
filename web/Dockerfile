# syntax=docker/dockerfile:1
# Build context is the REPOSITORY ROOT (npm workspaces: web + packages/*). See docker-compose.yml.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY packages/core/package.json packages/core/
COPY api/package.json api/
COPY packages/data/package.json packages/data/
COPY packages/db-types/package.json packages/db-types/
COPY packages/edge/package.json packages/edge/
RUN npm ci --workspace web --workspace @bj/edge --include-workspace-root=false

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined at build time.
ARG NEXT_PUBLIC_SITE_URL=https://beejunior.meducation.vn
ARG NEXT_PUBLIC_ADSENSE_CLIENT
ARG NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT
ARG NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR
ARG NEXT_PUBLIC_ADSENSE_SLOT_FOOTER
ARG SEO_NOINDEX=false
ARG ROOMS_ENABLED=false
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT \
    NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT=$NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT \
    NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=$NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR \
    NEXT_PUBLIC_ADSENSE_SLOT_FOOTER=$NEXT_PUBLIC_ADSENSE_SLOT_FOOTER \
    SEO_NOINDEX=$SEO_NOINDEX \
    ROOMS_ENABLED=$ROOMS_ENABLED
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages ./packages
COPY web ./web
RUN mkdir -p web/public && npm run build --workspace web && npm run build --workspace @bj/edge

FROM node:22-alpine AS runner
ARG ROOMS_ENABLED=false
WORKDIR /app
# ROOMS_ENABLED at runtime too: force-dynamic pages (home) read the flag per request.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 ROOMS_ENABLED=$ROOMS_ENABLED
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
# Standalone output is nested under web/ because the workspace root is the tracing root.
COPY --from=build --chown=app:app /app/web/.next/standalone ./
COPY --from=build --chown=app:app /app/web/.next/static ./web/.next/static
COPY --from=build --chown=app:app /app/web/public ./web/public
# Edge HTML cache (blueprint §4): started instead of web/server.js by deploy/compose.yml (CMD node edge/edge.mjs).
COPY --from=build --chown=app:app /app/packages/edge/dist/edge.mjs ./edge/edge.mjs
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "web/server.js"]
