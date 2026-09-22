# Dhaka Tesla Pool — Plan Book

**For:** Shahidul Islam · **Challenge:** RoBenDevs internship PRD · **Budget:** ~7 days
**Stack (decided):** pnpm monorepo · NestJS 11 + Prisma 6 + PostgreSQL 16 · Next.js App Router + Tailwind + shadcn/ui + TanStack Query · Docker Compose · Vercel + Render + Neon (all free tier)

> New here? Read [START-HERE.md](START-HERE.md) first: reading order, checkpoints, and how to implement with AI without losing ownership.

## How to use this book

1. Read `00` to `04` fully before writing a line of code (about 90 minutes). The evaluators score understanding; these four documents are what you must be able to say out loud.
2. Follow the 7-day schedule below. Each day names the branches to finish and the doc that specifies them.
3. When you use Claude Code / Cursor, paste the relevant doc section into the prompt as the spec. Do not let the AI invent a different schema, status name, or endpoint path. Consistency across code, tests, README, and video is the whole game.
4. Every evening: `git log --first-parent --oneline master`. Anything there that is not a merge commit (after the scaffold) is a feature pushed straight to master. Fix it before it multiplies.
5. Where this book says "documented assumption", write that sentence into the README "Key decisions" section as you build. Do not leave README writing for Day 6.

| Doc | Content |
|---|---|
| [01-tech-stack](01-tech-stack.md) | Every non-mandated choice: pick, alternatives, why it fits ride-pooling, switch trigger |
| [02-architecture](02-architecture.md) | System diagram, request flows, monorepo and NestJS module layout |
| [03-database-design](03-database-design.md) | ERD, every table and column, constraints, indexes, migration SQL Prisma cannot generate |
| [04-domain-rules](04-domain-rules.md) | State machines, matching rule, fare model with worked numbers, cancellation, payments, edge cases, concurrency |
| [05-api-design](05-api-design.md) | Endpoints, auth, error format and codes, payloads |
| [06-frontend-design](06-frontend-design.md) | Routes, screens, auth guard, loading/error/empty convention, polling, pitfalls |
| [07-docker-and-deploy](07-docker-and-deploy.md) | Compose, Dockerfiles, entrypoint, env files, Render/Neon/Vercel steps |
| [08-testing-plan](08-testing-plan.md) | The six mandated behaviours and how each test proves them |
| [09-git-workflow](09-git-workflow.md) | Branches, commit plan, merge policy, release cut, evaluator traps |
| [10-readme-video-ai](10-readme-video-ai.md) | README skeleton, 6-minute script, screenshots, AI-usage examples |
| [11-viral-scale-bonus](11-viral-scale-bonus.md) | "If Oi Tesla goes viral" reasoning and diagram |
| [12-interview-prep](12-interview-prep.md) | Questions they will ask and answers grounded in this design |

## The cast (use everywhere: seed, tests, README, video)

| Person | Role | Detail |
|---|---|---|
| Jashim | Driver | Owns **Bullet**, capacity 3, serves Banani |
| Nusrat | Passenger | Banani → Mohakhali, 1 seat, TeslaPay, wallet 500.00 BDT |
| Rafiq | Passenger | Banani → Gulshan 1, 1 seat, cash |
| Shirin | Passenger | Banani → Gulshan 2, 1 seat, TeslaPay, wallet 30.00 BDT (too small; demonstrates cash-due fallback) |
| Kamal (optional) | Driver | Owns **Rocket**, capacity 2, offline by default; exists so the driver list is not a single row |

Never introduce `user1`, `test@test.com`, or `driver1`. The PRD says so twice.

## PRD line-by-line checklist

Tick these as you go. The right column names the doc that satisfies the line.

| # | PRD requirement | Where satisfied |
|---|---|---|
| 1 | Story cast in seed, tests, demo | 03 (seed), 08, 10 |
| 2 | Passenger sees own fare and status only; driver sees assignments and stage; history explains what happened | 04 (visibility), 03 (`ride_events`) |
| 3 | Passenger: sign up/in, request (pickup, destination, seats), estimated fare, status tracking, history, cancel while valid | 05, 06 |
| 3 | Driver: sign in, online/offline, own Tesla with fixed capacity, see relevant requests, accept, arrive/start/complete, see passengers/seats/history | 05, 06 |
| 3 | Pool: multiple requests share one Tesla, seats never exceed capacity, individual fares, clear lifecycle and membership | 03, 04 |
| 3 | Lifecycle REQUESTED → MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED (+ CANCELLED), "improve if you can explain why" | 04 (IN_PROGRESS rename, pool vs request states) |
| 4 | Simple geography: predefined zones with lat/lng; documented matching rule applied to Nusrat and Rafiq | 03 (`zones`), 04 (matching) |
| 5 | Simple, testable fare; hand-checkable with Nusrat and Rafiq; explain money storage; cash or TeslaPay | 04 (fare, payments) |
| 6 | Backend: API design, auth, validation, business-logic placement, errors, transitions, capacity, consistency, organisation, logging, security; REST vs GraphQL explained | 02, 05, 04 |
| 6 | Frontend: flows/states, loading/error/empty, component organisation, integration | 06 |
| 6 | Database: schema with relationships, constraints, indexes, types; explain every table | 03 |
| 6 | Docker: `docker compose up`, app + DB containers, `.env.example`, migrations, seed, health checks | 07 |
| 6 | Deployment: free tier only; public preferred; else documented Docker deployment | 07 |
| 7 | Every non-mandated choice justified with alternatives and switch triggers | 01 |
| 8 | AI usage section: tools, what for, one accepted, one rejected | 10 |
| 9 | Architecture diagram (Browser → Next.js → Node API → DB) and ERD; no microservices/Kafka/K8s/Redis/queues | 02, 03, 11 |
| 10 | Branches `master`, `pre-release`, `release/v1.0.0`, `feature/*`; incremental history | 09 |
| 11 | Conventional commit messages, one logical change each | 09 |
| 12 | README minimum sections | 10 |
| 12 | Tests: capacity, invalid transitions, pooled fares, ownership, cancellation, concurrency | 08 |
| 12 | Concurrency design documented now and at scale | 04, 11 |
| 12 | Bonus: viral-scale reasoning | 11 |
| 13 | 6-minute video with the three segments | 10 |
| 14 | Submission checklist | 10 (final checklist) |
| 16 | Do-nots (pay, secrets, giant commit, direct-to-master, show-off tech, polish over integrity, hide AI, strip cast) | 09, 10 |
| 17 | Assumptions documented | 04 (assumption list), README "Key decisions" |

## 7-day schedule

Assumes 8–10 focused hours per day. Each row ends with the branch merged into `master` with `--no-ff`.

| Day | Deliverables | Branches | Docs |
|---|---|---|---|
| 1 | Repo with `master` default; GitHub squash/rebase merges disabled; pnpm workspace; NestJS app with `/health`; Next.js app with shadcn; Prisma schema; first migration with hand-added CHECKs and partial unique indexes; idempotent seed; `docker compose up db` works; **skeleton API deployed to Render + Neon and skeleton web to Vercel**; 30-second OBS recording test | `feature/monorepo-scaffold`, `feature/database-schema` | 02, 03, 07, 09 |
| 2 | Signup/login/me with guards; fare module with unit tests; ride request create/list/detail/cancel with e2e tests against the test database | `feature/auth`, `feature/fare`, `feature/ride-requests` | 04 (fare), 05, 08 |
| 3 | Pools: driver status, accept + sweep, arrive/start/complete/cancel with cascades, `joinPool`/`leavePool`, transition tables, auto-cancel empty pool, fare lock, wallet settlement; **concurrency test green**; API Dockerfile builds and boots with migrate + seed. Do not touch the frontend until the race test passes | `feature/pooling` | 04, 08, 07 |
| 4 | Web: api client, login/register, `RequireRole`, cold-start banner, passenger request form with fare preview, ride status page with polling, history | `feature/web-auth`, `feature/web-passenger` | 06 |
| 5 | Web: driver dashboard, pool detail manifest with actions; web Dockerfile; full `docker compose down -v && docker compose up` from a clean clone; scaling notes | `feature/web-driver`, `feature/docker`, `feature/scale-notes` | 06, 07, 11 |
| 6 | Cut `pre-release`; point Render and Vercel at it; CORS and env verified live; README complete with screenshots/GIFs from the deployed app; ERD and architecture render on GitHub | `pre-release` | 10 |
| 7 | Morning: record video (max 3 takes), upload unlisted to YouTube, link in README. Cut `release/v1.0.0`, tag, merge back. Afternoon: fresh clone on another machine or clean Docker context, click every README link, reread the commit log | `release/v1.0.0` | 10, 09 |

### Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Frontend overruns into Day 6 | High | Hard cut-over at the end of Day 5. Unfinished UI becomes a "Known limitations" line. Day 6 starts with `git checkout -b pre-release` no matter what |
| Prisma 7 / Alpine / pnpm Docker friction eats Day 3 | Medium | Pin Prisma 6, `binaryTargets` for musl, `apk add openssl`. If Alpine still fights, switch base to `node:22-slim` (two-line change) |
| Render/Neon/Vercel surprises on Day 6 | Medium | Day 1 skeleton deploy proves the pipeline while the app is tiny |
| Video tool caps at 5 minutes (Loom free) | Certain if Loom | Use OBS Studio, upload unlisted to YouTube. Test the mic on Day 1 |
| AI generates schema/endpoint names that drift from the docs | High | Paste the doc section as the spec; grep for drift before each commit |
| Commit history looks fake (all commits on the last night, `wip`, giant merges) | Medium | Commit after every logical unit during the day; never `git add -A` at the end of a session; `git add -p` to split |
| Evaluator's first request hits a cold Render instance and they think it is broken | High | README callout at the very top, in-app cold-start banner, optional keep-alive ping during evaluation week |

## Definition of done (submission)

- [ ] Public repo, `master` default, `pre-release` and `release/v1.0.0` exist, tag `v1.0.0` pushed
- [ ] `docker compose up` from a clean clone reaches three healthy containers, app usable at `http://localhost:3000`
- [ ] All tests pass (`pnpm --filter api test` and `pnpm --filter api test:e2e`)
- [ ] Deployed URLs in README; cold-start note at top
- [ ] README contains every section in 10
- [ ] Video linked, ≤ 6:00
- [ ] No `.env`, no secrets, no `node_modules` in history (`git log --all --diff-filter=A --name-only | grep -E '\.env$'` returns nothing)
- [ ] Every table, transition, and decision in this book can be explained without reading notes
