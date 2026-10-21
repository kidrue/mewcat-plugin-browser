FROM node:22-bookworm-slim AS base
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/service/package.json ./apps/service/package.json
COPY packages/mewcat-protocol/package.json ./packages/mewcat-protocol/package.json
COPY packages/mewcat-client/package.json ./packages/mewcat-client/package.json
RUN pnpm --filter @mewcat/service... install --frozen-lockfile --ignore-scripts
COPY apps/service ./apps/service
COPY packages/mewcat-protocol ./packages/mewcat-protocol
COPY packages/mewcat-client ./packages/mewcat-client
COPY scripts ./scripts
ENV MEWCAT_LOAD_LOCAL_ENV=false
RUN pnpm -r rebuild better-sqlite3 @prisma/engines esbuild
RUN pnpm --filter @mewcat/service... -r build
RUN pnpm --filter @mewcat/service deploy --legacy /export/tools
RUN pnpm --filter @mewcat/service deploy --legacy --prod /export/runtime

FROM base AS tools
WORKDIR /app
COPY --from=build --chown=node:node /export/tools ./
RUN mkdir -p /app/data /app/secrets && chown -R node:node /app
USER node
CMD ["node", "--run", "db:migrate:raw"]

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /export/runtime/node_modules ./node_modules
COPY --from=build --chown=node:node /export/runtime/dist ./dist
COPY --from=build --chown=node:node /export/runtime/package.json ./package.json
RUN mkdir -p /app/data /app/secrets && chown node:node /app/data /app/secrets
USER node
EXPOSE 3000
CMD ["node", "dist/src/server.js"]
