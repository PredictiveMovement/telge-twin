FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/sampleAddresses/package.json packages/sampleAddresses/

RUN pnpm fetch
RUN pnpm install --frozen-lockfile --ignore-scripts --filter ./packages/sampleAddresses

COPY packages/sampleAddresses packages/sampleAddresses

RUN pnpm deploy --filter ./packages/sampleAddresses --prod /app/output

FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY --from=builder /app/output/ ./
ENV PORT=4001
EXPOSE 4001
CMD ["node", "index.js"]
