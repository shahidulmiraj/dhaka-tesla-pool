# Dhaka Tesla Pool

> Share a seat. Split the fare. Survive Dhaka traffic.

A ride-pooling MVP for Dhaka's battery "Teslas". Passengers request a seat between predefined zones,
compatible trips share one vehicle without ever exceeding its capacity, every passenger sees only their
own fare and status, and every ride keeps a history that explains exactly what happened.

Built around the PRD's cast: **Jashim** drives **Bullet** (3 seats) in Banani; **Nusrat** (→ Mohakhali),
**Rafiq** (→ Gulshan 1) and **Shirin** (→ Gulshan 2) want to share it.

## Stack

pnpm monorepo · NestJS 11 + Prisma 6 + PostgreSQL 16 · Next.js (App Router) + Tailwind + shadcn/ui +
TanStack Query · Docker Compose.

_Work in progress: sections are added as each feature branch lands._

## Run with Docker

```bash
git clone https://github.com/shahidulmiraj/dhaka-tesla-pool.git && cd dhaka-tesla-pool
cp .env.example .env          # set JWT_SECRET: openssl rand -hex 32
docker compose up --build     # db, api, web; wait for three "healthy"
```

Open <http://localhost:3000> and sign in as `nusrat@teslapool.demo` / `Dhaka2026!`.
Port 3000 taken? Set `WEB_PORT=3003` in `.env`; the API's CORS origin follows it.

On every boot the API container runs `prisma migrate deploy`, then the idempotent seed, then the server.
Reset everything with `docker compose down -v`.

## Local development

```bash
pnpm install
docker compose up -d db
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter api exec prisma migrate deploy
pnpm --filter api seed
pnpm --filter api start:dev      # http://localhost:3001, Swagger at /docs
pnpm --filter web dev            # http://localhost:3000
```

## Tests

```bash
docker compose up -d db          # tests use the tesla_pool_test database
pnpm --filter api test           # unit: fare, transitions, matching
pnpm --filter api test:e2e       # e2e against real PostgreSQL, --runInBand
```
