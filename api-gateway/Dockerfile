FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install dependencies first (Docker layer caching)
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY api-gateway/package*.json ./api-gateway/

RUN npm ci --workspace=api-gateway --workspace=shared --omit=dev

# Copy source
COPY shared ./shared
COPY api-gateway ./api-gateway
COPY .env.example .env

EXPOSE 3000

USER node

CMD ["node", "api-gateway/src/index.js"]
