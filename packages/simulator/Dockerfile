FROM node:16-slim

WORKDIR /app

COPY package.json package-lock.json ./

COPY packages/simulator ./packages/simulator

RUN npm ci --workspace=packages/simulator --production

WORKDIR /app/packages/simulator

ENV ELASTICSEARCH_URL=$ELASTICSEARCH_URL

RUN npm run preboot

EXPOSE 4000

CMD ["npm","start"]
