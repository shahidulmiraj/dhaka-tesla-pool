# 07 — Docker and Deployment

Goal: `git clone && cp .env.example .env && docker compose up` gives three healthy containers and a usable app at `http://localhost:3000`. The same API image runs on Render.

## docker-compose.yml

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init-test-db.sql:/docker-entrypoint-initdb.d/01-test-db.sql
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      DIRECT_URL:   postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-24h}
      CORS_ORIGIN: http://localhost:3000
      PORT: 3001
      NODE_ENV: production
    ports: ["3001:3001"]
    depends_on:
      db: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 6
      start_period: 30s

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: http://localhost:3001
    ports: ["3000:3000"]
    depends_on:
      api: { condition: service_healthy }

volumes:
  pgdata: {}
```

`docker/init-test-db.sql`:

```sql
CREATE DATABASE tesla_pool_test;
```

Runs once when the volume is created, so the test database exists in the same container. No second Postgres service.

Notes:
- `$$POSTGRES_USER` (double dollar) so Compose does not interpolate host-side.
- Alpine has `wget` (BusyBox), not `curl`.
- The browser runs on the host, so the web image is built with `http://localhost:3001`. Only server-to-server URLs use service names (`db`).

## API image

`apps/api/Dockerfile` (build context = repo root):

```dockerfile
FROM node:22-alpine AS base
RUN apk add --no-cache openssl && npm i -g pnpm@10
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api
COPY apps/api apps/api
RUN pnpm --filter api exec prisma generate && pnpm --filter api build
RUN pnpm --filter api deploy --prod /out

FROM base AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY apps/api/docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh
EXPOSE 3001
CMD ["sh", "docker-entrypoint.sh"]
```

`apps/api/docker-entrypoint.sh`:

```sh
#!/bin/sh
set -e
echo "Running migrations"
npx prisma migrate deploy
echo "Seeding (idempotent)"
node dist/seed.js
echo "Starting API"
exec node dist/main.js
```

Rules that make this work:
- `prisma` stays in `dependencies` (not `devDependencies`) because `migrate deploy` runs in the production image.
- `seed.ts` sits in `apps/api/src/` so `nest build` compiles it with no extra config. It uses upserts only.
- `schema.prisma` has `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` so the Alpine engine is generated.
- `apk add openssl` avoids Prisma's "failed to detect libssl" on Alpine 3.21+.
- If Alpine still misbehaves: `FROM node:22-slim`, `apt-get update && apt-get install -y openssl`, drop the musl binary target. Two lines.
- `main.ts` listens on `process.env.PORT` and `0.0.0.0`. Render injects `PORT`.

## Web image

`apps/web/Dockerfile` (build context = repo root):

```dockerfile
FROM node:22-alpine AS build
RUN npm i -g pnpm@10
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter web build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

`next.config.ts`: `output: 'standalone'`, `outputFileTracingRoot: path.join(__dirname, '../../')`.

## Environment files

Three `.env.example` files, each explaining one runtime. Commit all three; never commit `.env`.

`/.env.example` (Compose):
```
POSTGRES_USER=tesla
POSTGRES_PASSWORD=tesla_local_only
POSTGRES_DB=tesla_pool
JWT_SECRET=replace-with-32-random-chars
JWT_EXPIRES_IN=24h
```

`/apps/api/.env.example` (running the API on the host with `pnpm dev`):
```
DATABASE_URL=postgresql://tesla:tesla_local_only@localhost:5432/tesla_pool
DIRECT_URL=postgresql://tesla:tesla_local_only@localhost:5432/tesla_pool
TEST_DATABASE_URL=postgresql://tesla:tesla_local_only@localhost:5432/tesla_pool_test
JWT_SECRET=replace-with-32-random-chars
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
PORT=3001
```

`/apps/web/.env.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Add `.env`, `.env.local`, `.env.*.local` to `.gitignore` on Day 1 before anything else. Generate `JWT_SECRET` with `openssl rand -hex 32`.

## Local development without Docker (faster loop)

```
docker compose up -d db
cp apps/api/.env.example apps/api/.env
pnpm --filter api exec prisma migrate dev
pnpm --filter api exec ts-node src/seed.ts     # or pnpm --filter api seed
pnpm --filter api start:dev                     # :3001, Swagger at /docs
pnpm --filter web dev                           # :3000
```

## Hosting (all free tier, verified September 2026)

| Service | Plan facts | Setup |
|---|---|---|
| **Neon** (Postgres) | Free: 0.5 GB storage, 100 compute-hours/month, autosuspend after 5 min idle (adds ~1 s to the next query) | Create project `dhaka-tesla-pool`, database `tesla_pool`. Copy **pooled** connection string → `DATABASE_URL`; **direct** (unpooled) string → `DIRECT_URL`. Prisma 6 uses `directUrl` for migrations |
| **Render** (API) | Free web service: sleeps after 15 min idle, ~1 min wake, 750 instance-hours/month per workspace (enough for one always-available service); Docker runtime supported; free Postgres expires after 30 days (which is why Neon) | New Web Service → connect repo → Language **Docker** → Root Directory `.` (repo root) → Dockerfile Path `apps/api/Dockerfile` → Branch `pre-release` (later `release/v1.0.0`) → Health Check Path `/health` → Env: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN=https://<project>.vercel.app`, `NODE_ENV=production`. Do not set `PORT`; Render injects it |
| **Vercel** (web) | Hobby: non-commercial use, generous limits for this | Import repo → Root Directory `apps/web` → Framework Next.js (auto) → Env `NEXT_PUBLIC_API_URL=https://<api>.onrender.com` → Production Branch `pre-release`, later `release/v1.0.0`. Redeploy after any env change (baked at build) |

Order on Day 1: Neon first (you need the URLs), then Render (you need the API URL), then Vercel (you need to put the Vercel URL into Render's `CORS_ORIGIN` and redeploy Render once).

Alternatives considered and rejected: Koyeb (equivalent, smaller ecosystem), Fly.io (no free tier any more), Railway (one-time trial that can expire mid-evaluation), Render Postgres (30-day expiry), Supabase (more than needed; would also work).

## Cold-start UX

1. README, first screen: "The API runs on Render's free tier and sleeps after 15 minutes. The first request can take up to 60 s. Open `https://<api>.onrender.com/health` first and wait for `{"status":"ok"}`."
2. In-app `ColdStartBanner` (see 06).
3. Optional during evaluation week: a free cron ping (cron-job.org) hitting `/health` every 10 minutes. Within the monthly hour budget; disclose it in the README as "keep-alive ping, disabled after evaluation" if used.

## Verification before calling Docker done (Day 5)

```
git clone <repo> /tmp/fresh && cd /tmp/fresh
cp .env.example .env
docker compose up --build
# wait for three "healthy"
docker compose ps
curl -s localhost:3001/health
open http://localhost:3000   # log in as nusrat@teslapool.demo / Dhaka2026!
docker compose down -v      # then up again: seed must not duplicate
```

Capture the terminal for the README ("docker compose up to healthy" screenshot) while you are at it.
