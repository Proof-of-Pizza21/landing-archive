# syntax=docker/dockerfile:1.7
# Tag and multi-platform index verified against Docker Hub on 2026-09-05.
ARG NODE_IMAGE=node:24.13.1-bookworm-slim@sha256:a81a03dd965b4052269a57fac857004022b522a4bf06e7a739e25e18bce45af2
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.server.json tsconfig.web.json vite.config.ts ./
COPY src ./src
COPY web ./web
RUN npm run build && npm prune --omit=dev

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4310 \
    DATA_DIR=/data \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    XDG_CONFIG_HOME=/tmp/landing-archive/config \
    XDG_CACHE_HOME=/tmp/landing-archive/cache
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
# The CLI comes from the lockfile; do not download a different Playwright version.
RUN ./node_modules/.bin/playwright install --with-deps chromium \
    && mkdir -p /data \
    && chown 1000:1000 /data \
    && chmod -R a+rX /ms-playwright \
    && rm -rf /var/lib/apt/lists/* /root/.npm
COPY --from=build /app/dist ./dist
COPY --from=build /app/web-dist ./web-dist
COPY LICENSE THIRD_PARTY_NOTICES.md README.md ./
# Ship the corresponding application source with the binary distribution.
COPY src ./source/src
COPY web ./source/web
COPY tests ./source/tests
COPY tsconfig.server.json tsconfig.web.json vite.config.ts Dockerfile ./source/
COPY package.json package-lock.json ./source/
COPY README.md LICENSE THIRD_PARTY_NOTICES.md compose.yaml .dockerignore ./source/
COPY docs ./source/docs
COPY umbrel-community-store ./source/umbrel-community-store
COPY umbrel-community-store/proof-of-pizza21-landing-archive/LICENSE-PLAYWRIGHT ./licenses/LICENSE-PLAYWRIGHT
LABEL org.opencontainers.image.title="Landing Archive" \
      org.opencontainers.image.description="Archivio locale delle versioni di siti e landing page" \
      org.opencontainers.image.authors="Proof-of-Pizza21" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"
USER 1000:1000
EXPOSE 4310
STOPSIGNAL SIGTERM
CMD ["node", "dist/server.js"]
