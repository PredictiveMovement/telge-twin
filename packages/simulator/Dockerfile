FROM node:16-slim

WORKDIR /app

COPY package.json package-lock.json ./

COPY . .

RUN npm ci --production

WORKDIR /app/packages/simulator

ENV ELASTICSEARCH_URL=$ELASTICSEARCH_URL

RUN npm run preboot

EXPOSE 4000

CMD ["npm","start"]
