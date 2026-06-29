# zk-jam-service-web — the Next.js dashboard, backend-switchable (polkajam | lasair).
#
# Build (from client/web):  docker build -t zk-jam-service-web .
# Run:   docker run --rm -p 3000:3000 \
#          -e JAM_BACKEND=lasair -e LASAIR_RPC=http://lasair-node:19900 \
#          -e NEXT_PUBLIC_JAM_SERVICE_ID=1729 zk-jam-service-web
#
# Uses Next's standalone output (next.config.ts: output: "standalone").

# ---- deps ----------------------------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- build ---------------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime -------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# JAM backend defaults; override at run time.
ENV JAM_BACKEND=lasair
ENV LASAIR_RPC=http://lasair-node:19900

# standalone server + static assets
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

LABEL org.opencontainers.image.title="zk-jam-service-web" \
      org.opencontainers.image.description="zk-jam-service dashboard (Next.js), backend-switchable polkajam|lasair." \
      org.opencontainers.image.source="https://github.com/abutlabs/zk-jam-service"

EXPOSE 3000
CMD ["node", "server.js"]
