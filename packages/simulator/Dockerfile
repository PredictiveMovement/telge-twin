FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/simulator/package.json packages/simulator/

RUN pnpm fetch
RUN pnpm install --frozen-lockfile --ignore-scripts --filter ./packages/simulator

COPY packages/simulator packages/simulator

ARG ELASTICSEARCH_URL
RUN ELASTICSEARCH_URL="${ELASTICSEARCH_URL}" pnpm --filter ./packages/simulator run build
RUN pnpm --filter ./packages/simulator run preboot

RUN pnpm deploy --filter ./packages/simulator --prod /app/output

FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/output/ ./
COPY --from=builder /app/packages/simulator/data ./dist/data

EXPOSE 4000
CMD ["node", "dist/web/index.js"]
