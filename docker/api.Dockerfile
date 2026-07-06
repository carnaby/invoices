# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY patches ./patches
COPY libs/shared/package.json libs/shared/package.json
COPY libs/db/package.json libs/db/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @invoices/api... --prod=false
COPY tsconfig.base.json ./
COPY --exclude=**/node_modules libs ./libs
COPY --exclude=**/node_modules apps/api ./apps/api
EXPOSE 3333
CMD ["pnpm", "--filter", "@invoices/api", "start"]
