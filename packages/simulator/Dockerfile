FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/simulator/package.json packages/simulator/

RUN pnpm fetch
RUN pnpm install --frozen-lockfile --ignore-scripts --filter ./packages/simulator

COPY packages/simulator packages/simulator

ARG ELASTICSEARCH_URL
ARG TELGE_API_BASE_URL
ARG TELGE_API_USERNAME
ARG TELGE_API_PASSWORD
RUN ELASTICSEARCH_URL="${ELASTICSEARCH_URL}" \
    TELGE_API_BASE_URL="${TELGE_API_BASE_URL}" \
    TELGE_API_USERNAME="${TELGE_API_USERNAME}" \
    TELGE_API_PASSWORD="${TELGE_API_PASSWORD}" \
    pnpm --filter ./packages/simulator run build
RUN mkdir -p packages/simulator/dist/data \
    && cp -a packages/simulator/data/. packages/simulator/dist/data/


RUN pnpm --filter ./packages/simulator deploy --prod --legacy /app/output

FROM node:20-slim AS runner
ARG TELGE_API_BASE_URL
ARG TELGE_API_USERNAME
ARG TELGE_API_PASSWORD
ENV NODE_ENV=production
ENV TELGE_API_BASE_URL=${TELGE_API_BASE_URL}
ENV TELGE_API_USERNAME=${TELGE_API_USERNAME}
ENV TELGE_API_PASSWORD=${TELGE_API_PASSWORD}
WORKDIR /app

COPY --from=builder /app/output/ ./
COPY --from=builder /app/packages/simulator/data ./dist/data

EXPOSE 4000
CMD ["node", "dist/web/index.js"]
