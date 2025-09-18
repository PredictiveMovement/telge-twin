FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/visualisation/package.json packages/visualisation/

RUN pnpm fetch
RUN pnpm install --frozen-lockfile --ignore-scripts --filter ./packages/visualisation

COPY packages/visualisation packages/visualisation

ARG VITE_MAPBOX_ACCESS_TOKEN
ARG VITE_SIMULATOR_URL
RUN VITE_MAPBOX_ACCESS_TOKEN="${VITE_MAPBOX_ACCESS_TOKEN}" \
    VITE_SIMULATOR_URL="${VITE_SIMULATOR_URL}" \
    pnpm --filter ./packages/visualisation run build

FROM nginx:1.27-alpine
COPY packages/visualisation/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/visualisation/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
