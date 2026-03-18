FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
COPY plugins/shre/package.json plugins/shre/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm build

# Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/apps/web/dist ./dist
COPY --from=build /app/aros.config.json .
COPY --from=build /app/whitelabel ./whitelabel
COPY --from=build /app/package.json .

RUN addgroup -g 1001 -S aros && adduser -S aros -u 1001
USER aros

EXPOSE 3000
CMD ["node", "dist/server.js"]
