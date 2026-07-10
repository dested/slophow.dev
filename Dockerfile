# slopshow — Bun + Express SSR, single-stage build.
FROM oven/bun:1.3
WORKDIR /app

COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

ENV NODE_ENV=production
# Uploaded bundles + images live here — mount a volume so they survive deploys.
ENV DATA_DIR=/data
VOLUME /data

EXPOSE 3000
CMD ["bun", "server.ts"]
