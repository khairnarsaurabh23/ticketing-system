FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY ticket-service/package*.json ./ticket-service/

RUN npm ci --workspace=ticket-service --workspace=shared --omit=dev

COPY shared ./shared
COPY ticket-service ./ticket-service
COPY .env.example .env

EXPOSE 3002

USER node

ENV RUN_MIGRATIONS=true
CMD ["node", "ticket-service/src/index.js"]
