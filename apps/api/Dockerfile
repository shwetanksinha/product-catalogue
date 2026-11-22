# Build context is the repository root (see docker-compose.yml).
FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

FROM base AS build
RUN npm ci -w @catalogue/api
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @catalogue/api

FROM base AS prod-deps
RUN npm ci -w @catalogue/api --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json apps/api/
COPY apps/api/config apps/api/config
WORKDIR /app/apps/api
USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/server.js"]
