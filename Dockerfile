FROM node:22-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json

RUN npm ci

FROM node:22-slim AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY .npmrc ./
COPY apps/api ./apps/api
COPY packages/core ./packages/core

RUN npm run build -w @hayfever/core
RUN npm run build -w @hayfever/api

FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
COPY .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/core/package.json packages/core/package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist

EXPOSE 8080
CMD ["npm", "run", "start", "-w", "@hayfever/api"]
