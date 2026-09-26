# Build context: repository root (docker compose and Render both use it).
FROM node:22-alpine AS base
RUN apk add --no-cache openssl && npm i -g pnpm@10
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api
COPY apps/api apps/api
RUN pnpm --filter api exec prisma generate && pnpm --filter api build
# Self-contained, flat (npm-style) production node_modules (deploy also copies
# prisma/). Prisma generates the client next to the @prisma/client it finds from
# the schema's folder, so it is regenerated inside /out.
RUN pnpm --filter api deploy --prod --legacy --config.node-linker=hoisted /out \
 && cd /out && ./node_modules/.bin/prisma generate

FROM base AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /out/prisma ./prisma
COPY apps/api/docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh
EXPOSE 3001
CMD ["sh", "-c", "./docker-entrypoint.sh"]
