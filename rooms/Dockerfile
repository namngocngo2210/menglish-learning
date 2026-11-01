# syntax=docker/dockerfile:1
# Build context is the REPOSITORY ROOT (the bank is built from web/content/tests):
#   docker build -f rooms/Dockerfile -t menglish-learning-rooms:latest .
# Ignore rules live in rooms/Dockerfile.dockerignore (the root .dockerignore excludes rooms/).
FROM node:22-alpine AS build
WORKDIR /app
COPY rooms/package.json rooms/package-lock.json rooms/
RUN cd rooms && npm ci
COPY rooms rooms
# rooms imports the shared mixer/scoring sources (web/lib -> @bj/core).
COPY packages/core packages/core
COPY web/lib web/lib
COPY web/content/tests web/content/tests
# bank-rooms.json holds the answer keys: it stays inside the image, never under web/public.
RUN cd rooms && npm run build:bank && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100 ROOMS_BANK_PATH=/app/data/bank-rooms.json
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
COPY --from=build --chown=app:app /app/rooms/dist/server.mjs ./server.mjs
COPY --from=build --chown=app:app /app/rooms/data/bank-rooms.json ./data/bank-rooms.json
USER app
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:3100/rt/healthz >/dev/null || exit 1
CMD ["node", "--max-old-space-size=160", "server.mjs"]
