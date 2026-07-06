# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
ENV NODE_ENV=production
# Chrome for Testing runtime dependencies + fonts (Debian bookworm).
# No chromium package here: apt's bookworm chromium (150.0.7871.46) crashes
# with SIGTRAP even standalone (`chromium --headless=new --no-sandbox`) --
# not a seccomp/shm issue. Puppeteer's own tested Chrome for Testing build
# is installed explicitly below instead.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation fonts-dejavu-core wget xdg-utils \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 \
    libdbus-1-3 libdrm2 libexpat1 libgbm1 libglib2.0-0 libnspr4 libnss3 \
    libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 \
    libxfixes3 libxkbcommon0 libxrandr2 \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY patches ./patches
COPY libs/shared/package.json libs/shared/package.json
COPY libs/db/package.json libs/db/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @invoices/api... --prod=false
# Explicit, deterministic Chrome for Testing install (matches puppeteer's
# pinned version) rather than relying on postinstall, since pnpm 10 blocks
# lifecycle scripts by default and this repo has no onlyBuiltDependencies
# allowlist. Runs as root (no USER directive in this image), same as the
# runtime process, so puppeteer's launch() finds it under root's default
# cache dir (~/.cache/puppeteer) with no PUPPETEER_EXECUTABLE_PATH needed.
RUN pnpm --filter @invoices/api exec puppeteer browsers install chrome
COPY tsconfig.base.json ./
COPY --exclude=**/node_modules libs ./libs
COPY --exclude=**/node_modules apps/api ./apps/api
EXPOSE 3333
CMD ["pnpm", "--filter", "@invoices/api", "start"]
