FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN NEXT_OUTPUT=standalone npm run build \
    && cp -a public/. .next/standalone/public/ \
    && cp -a .next/static .next/standalone/.next/

FROM base AS runtime
ENV NODE_ENV=production \
    POSE_MUSE_DOCKER_HOST=host.docker.internal \
    HOSTNAME=0.0.0.0 \
    PORT=43123
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 43123
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/status').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server.js"]
