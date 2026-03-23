FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY auth-service/package*.json ./auth-service/

RUN npm ci --workspace=auth-service --workspace=shared --omit=dev

COPY shared ./shared
COPY auth-service ./auth-service
COPY .env.example .env

EXPOSE 3001

USER node

ENV RUN_MIGRATIONS=true
CMD ["node", "auth-service/src/index.js"]
