# 01 — Tech Stack and Justification

The PRD mandates React/Next.js and Node.js and asks that every other choice be justified in the README with: what you picked, realistic alternatives, why it fits a ride-pooling MVP, and what would make you switch. This document is that section, written once so the README can quote it.

## Mandated

| Layer | Requirement | Pick |
|---|---|---|
| Frontend | React or Next.js | Next.js App Router (the version `create-next-app@latest` installs; write the exact version from `package.json` in the README) |
| Backend | Node.js | NestJS 11 |
| Database | Candidate's choice, relational recommended | PostgreSQL 16 |

## Choices

### Backend framework: NestJS

- **Alternatives:** Express (minimal, unopinionated), Fastify (fastest, plugin model), Hono.
- **Why for this MVP:** the PRD explicitly scores "business-logic placement, code organisation, validation, error handling, auth". NestJS gives modules, dependency injection, DTO validation via `ValidationPipe`, guards for roles, exception filters for one error shape, and Swagger generation. The candidate's production experience is ASP.NET Core with the same concepts (controllers, services, DI, attribute validation), so the mental model transfers directly and can be defended in the interview.
- **Cost:** more boilerplate than Express; slower cold start on Render (measured in hundreds of ms, irrelevant next to the 60 s free-tier wake).
- **Switch trigger:** if the API shrank to two or three endpoints, plain Fastify would be less ceremony. If cold-start latency mattered (serverless), Hono.

### ORM: Prisma 6 (pinned; do not take Prisma 7)

- **Alternatives:** Drizzle (SQL-first, lighter), TypeORM (decorator-heavy, older), Kysely (query builder only), raw `pg`.
- **Why:** typed client, migration files in plain SQL that can be hand-edited (needed for CHECK constraints and partial unique indexes Prisma cannot express), `directUrl` for Neon's pooled/unpooled split, and the closest experience to EF Core. Interactive transactions cover the pooling logic.
- **Why not 7:** Prisma 7 requires `"type": "module"`, a `prisma.config.ts`, driver adapters, and deprecates `directUrl`. NestJS 11's CLI emits CommonJS. That is a day of friction for zero evaluator value. This is also the "rejected AI suggestion" example (see 10).
- **Switch trigger:** if we needed heavy SQL (window functions, CTEs, PostGIS) in many places, Drizzle or Kysely. If bundle size or edge runtime mattered, Drizzle.

### Database: PostgreSQL 16

- **Alternatives:** MySQL 8, SQLite, MongoDB.
- **Why:** capacity enforcement is a relational integrity problem. Postgres gives CHECK constraints, partial unique indexes (one active ride per passenger, one active pool per driver), transactional DDL, `timestamptz`, enums, `jsonb` for event metadata, and row-level locking semantics that make the seat race provably safe. Neon offers a free hosted tier. SQLite cannot demonstrate concurrent writers; MongoDB would push invariants into application code.
- **Switch trigger:** none at this scale. At very large scale: partition by city (see 11), not a different engine.

### Validation: class-validator + class-transformer via `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`

- **Alternatives:** zod with `nestjs-zod`, Joi.
- **Why:** NestJS-native, decorators on DTOs, Swagger reads the same decorators. Whitelisting strips unknown fields, which is a basic security measure the PRD names.
- **Switch trigger:** if a shared package between web and API existed, zod schemas shared in both would replace duplicated DTOs. We deliberately have no shared package (see 02).

### Auth: JWT Bearer, bcrypt, `@nestjs/jwt`, `@nestjs/passport` optional

- **Alternatives:** session cookies, httpOnly cookie JWT, NextAuth/Auth.js, Clerk/Auth0.
- **Why:** API and web are on different origins (Render and Vercel). A Bearer token in `localStorage` works across origins with a plain CORS allow-list and needs no cookie/CSRF machinery. Roles live in the token payload and are re-checked from the database on `/auth/me`. bcrypt via `bcryptjs` avoids native build issues in Alpine.
- **Trade-off:** `localStorage` is readable by injected scripts (XSS). We mitigate with strict input validation, no `dangerouslySetInnerHTML`, and a 24 h expiry. Documented as a known limitation.
- **Switch trigger:** same-origin deployment (Next.js route handlers proxying to the API) would let us move to an httpOnly `SameSite=Lax` cookie. Multi-device revocation would need refresh tokens and a token table.

### API style: REST + OpenAPI (`@nestjs/swagger`)

- **Alternatives:** GraphQL, tRPC.
- **Why:** the domain is a small set of resources plus commands (accept, arrive, start, complete, cancel). REST verbs plus command sub-resources (`POST /driver/pools/:id/start`) read naturally, are testable with curl in the video, cache trivially, and produce Swagger UI for free. GraphQL adds a schema layer and resolver N+1 concerns with no consumer that needs field selection. tRPC would couple the frontend to the API's TypeScript, which we avoid without a shared package.
- **Switch trigger:** multiple clients with different field needs (mobile app plus partner API).

### Frontend data layer: TanStack Query

- **Alternatives:** SWR, plain `fetch` in `useEffect`, Redux Toolkit Query.
- **Why:** polling with `refetchInterval`, cache invalidation after mutations, `isPending`/`isError` states that map directly onto the loading/error/empty rubric, retry with backoff for the Render cold start.
- **Switch trigger:** a real-time channel (SSE/WebSocket) would replace polling but keep Query for caching.

### Styling: Tailwind + shadcn/ui

- **Alternatives:** Material UI, Chakra, plain CSS modules.
- **Why:** shadcn generates components into the repo (no runtime dependency, fully editable), Tailwind keeps styles colocated. The candidate has Tailwind experience. Forms, badges, skeletons, alerts, toasts are all covered.
- **Switch trigger:** a design system mandated by a client.

### Live updates: polling every 4 s

- **Alternatives:** Server-Sent Events, WebSockets (`@nestjs/websockets`).
- **Why:** one API instance on a free tier that sleeps; no socket server on Vercel; TanStack handles it in one option. Latency of ≤ 4 s is acceptable for "driver arrived". Polling stops on terminal states.
- **Switch trigger:** more than a few hundred concurrent open rides, or a product requirement for sub-second updates. SSE first (one-directional, works through proxies), WebSockets only if the client must push.

### Testing: Jest + supertest against real PostgreSQL

- **Alternatives:** Vitest, Testcontainers, mocked Prisma.
- **Why:** Jest is NestJS's default; supertest hits the real HTTP layer including guards and filters. Tests run against a `tesla_pool_test` database created by the compose `db` container's init script. Mocked Prisma would make the capacity and concurrency tests meaningless.
- **Switch trigger:** CI without Docker would push us to Testcontainers or a Neon branch per run.

### Logging: `nestjs-pino`

- **Alternatives:** NestJS built-in `Logger`, winston.
- **Why:** structured JSON lines with request id, method, path, status, duration out of the box. Render's log viewer shows them; Neon and Vercel need nothing. Pretty-printed in development via `pino-pretty`.
- **Switch trigger:** none for the MVP. At scale, ship to a log aggregator (see 11).

### Security basics: `helmet`, CORS allow-list, `@nestjs/throttler`, bcrypt cost 10

- **Why:** the PRD lists "basic security". Each is one line in `main.ts` or `AppModule`. Throttler at 100 requests/minute per IP on auth endpoints stops credential stuffing in the demo and shows awareness.
- **Switch trigger:** behind a real API gateway these move to the edge.

### Package manager and repo layout: pnpm workspaces monorepo

- **Alternatives:** two repos, npm workspaces, Turborepo/Nx.
- **Why:** the PRD says "repository" singular and inspects one history. pnpm is fast, strict, and `pnpm deploy` flattens a workspace package into a self-contained folder for the Docker image. No Turborepo: two packages do not need a task graph.
- **Switch trigger:** a third package (shared types) or CI caching needs would justify Turborepo.

### Hosting: Vercel (web), Render free web service in Docker runtime (API), Neon free (Postgres)

- **Alternatives:** Koyeb (equivalent, smaller ecosystem), Fly.io (no free tier any more), Railway (one-time trial that can expire mid-evaluation), Render Postgres (free instance expires after 30 days), Supabase (Postgres plus more than we need).
- **Why:** all three have durable free tiers as of September 2026. Render runs the same Dockerfile as compose, so "runs reliably elsewhere" is demonstrated by the same artifact. Neon provides pooled and direct connection strings which Prisma 6 supports natively.
- **Known cost:** Render free sleeps after 15 minutes idle and takes about a minute to wake. Documented in README and shown in the UI.
- **Switch trigger:** paying customers → a single provider with a paid always-on tier and a managed Postgres with backups.

### Video: OBS Studio, uploaded unlisted to YouTube

- **Why:** Loom's free plan caps recordings at 5 minutes; the PRD asks for up to 6. OBS is free with no cap. On Linux/Wayland use the "Screen Capture (PipeWire)" source.

## One-line summary for the README

> NestJS + Prisma 6 + PostgreSQL because seat capacity is a relational integrity problem and the team's production experience maps onto it; Next.js App Router + TanStack Query + shadcn for a small, state-correct UI; REST because the domain is resources plus commands; polling because one sleeping free-tier instance does not justify sockets; Docker Compose locally and the same image on Render, with Neon for Postgres and Vercel for the web.
