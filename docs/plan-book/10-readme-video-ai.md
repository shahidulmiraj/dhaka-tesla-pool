# 10 — README, Video, AI Usage, Submission

## README skeleton (headings in this order)

Write sections 5, 6, 7, 10–14, 17, 18 as you build (each feature branch's `docs:` commit). Day 6 is assembly.

```
# Dhaka Tesla Pool
> Share a seat. Split the fare. Survive Dhaka traffic.
[Live app] · [API health] · [Demo video] · [Swagger]
⚠️ Cold start: the API sleeps on Render's free tier; the first request can take ~60 s. Open /health first.

1.  Summary                      what it is in three sentences, who it is for
2.  Problem                      in your words: empty seats, fair split, driver visibility, explainable history
3.  Features                     passenger / driver / pooling / fare / status & history — bullet lists, what is NOT in
4.  Screenshots & GIFs           see list below
5.  Architecture                 Mermaid from 02 + two sentences on why no Redis/queues
6.  Data model                   Mermaid erDiagram from 03 + table-by-table one-liners
7.  Ride and pool lifecycle      two stateDiagrams from 04 + why IN_PROGRESS + pool vs request states
8.  Matching rule                the five conditions + Nusrat/Rafiq/Shirin distance table
9.  Fare model                   formula, constants, the worked table, money as integer paisa and why
10. Tech stack                   versions from package.json; link to "Key decisions" for justifications
11. Project structure            tree from 02
12. Prerequisites                Node 22, pnpm 10, Docker
13. Environment variables        table: name · used by · example · note; the three .env.example files
14. Run with Docker              docker compose up; what the entrypoint does; how to reset (down -v)
15. Local development            db in docker, api and web on host
16. Migrations & seed            migrate dev / deploy; hand-edited SQL warning (never db push); seed is idempotent
17. Tests                        commands; what the six PRD behaviours map to; race test note
18. Demo credentials             the cast with emails and the synthetic password
19. Deployment                   URLs, Render/Neon/Vercel, which branch is live, cold-start, keep-alive disclosure if used
20. API overview                 endpoint table from 05; error contract
21. Key decisions & trade-offs   NestJS, Prisma 6 not 7, REST, conditional UPDATE + CHECK, polling, JWT in localStorage, zone table not maps, revert on driver cancel, fare lock at start
22. Concurrency                  the Nusrat/Shirin paragraph from 04 §7, now and at scale
23. Assumptions                  the nine from 04 §9
24. Known limitations            no direction in matching, no GPS, no real payments, no frontend tests, cold start, single zone per driver
25. Next improvements            SSE, tiered discount, per-passenger dropoff order, ratings, refresh tokens, cancellation fee
26. If Oi Tesla goes viral       link to docs/scaling.md (from 11) with the diagram inline
27. AI usage                     tools, what for, accepted, rejected/changed — see below
28. Demo video                   link, duration, chapters
```

### Screenshots and GIFs (from the deployed app, Day 6)

Save under `docs/screenshots/`, reference relatively.

1. Login page
2. Register page, driver variant with vehicle fields
3. Passenger request form with fare preview "Up to 57.36 · 51.89 if pooled"
4. Ride status card at `MATCHED` showing "Jashim · Bullet · 1 co-passenger"
5. Ride history empty state
6. Driver dashboard: online, Banani, three waiting requests
7. Pool detail manifest "3 / 3 · Bullet is full" with three members and fares
8. Pool detail after completion: Shirin `PENDING (cash due)`, others `PAID`
9. Cold-start banner
10. GIF: Jashim taps Arrive → Nusrat's screen flips to "Driver arrived" within 4 s (two browser windows side by side)
11. Terminal: `docker compose up` to three healthy
12. Terminal: e2e run with the race test green
13. GitHub network graph showing feature branches merging into master, pre-release, release

Record GIFs with Peek or `wf-recorder` + `ffmpeg -vf "fps=10,scale=960:-1"`. Keep each under 3 MB.

## 6-minute video script

Tool: **OBS Studio** (Loom free caps at 5 minutes). Source "Screen Capture (PipeWire)" on Wayland. 1080p, 30 fps, mic tested on Day 1. Upload unlisted to YouTube; add chapters in the description. Max three takes; a small stumble is fine, a 7-minute video is not.

Have open before recording: README at the architecture section, ERD, `pools.service.ts` at `joinPool`, the race test, two browser windows (Nusrat, Jashim) plus a third for Rafiq/Shirin, a terminal with `docker compose ps`, GitHub network graph.

| Time | Segment (PRD requirement) | Say | Show |
|---|---|---|---|
| 0:00–1:00 | Problem, users, core idea in your own words | "Battery rickshaws in Banani run with empty seats. Jashim wants a full Bullet before he leaves; Nusrat and Rafiq want to get to Mohakhali and Gulshan for less, without coordinating with strangers. The system has to decide in a second whether trips are compatible, guarantee three seats never become four, give each rider only their own fare, and keep a history that explains every ride. I built the MVP around three actors: passenger, driver with a vehicle, and the pool that ties them together." | README top, cast table |
| 1:00–2:00 | Architecture, backend, frontend, database | "Browser → Next.js on Vercel → NestJS on Render → Postgres on Neon; same containers locally with Compose. NestJS because the rubric scores validation, guards, and logic placement, and it mirrors the ASP.NET Core structure I work in. Six tables: users, vehicles, zones, ride_requests, pools, ride_events." Walk the ERD: membership is `pool_id`, capacity is a snapshot on the pool, events are the audit trail. | Architecture Mermaid, ERD |
| 2:00–3:00 | Lifecycle, one key decision, one trade-off | "Two lifecycles: the pool moves OPEN → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED and cascades to its members. **Key decision:** every seat allocation is a single conditional UPDATE, `WHERE seats_taken + n ≤ capacity`; Postgres locks the row and re-evaluates the condition, so the second of two simultaneous claims sees the updated count and gets zero rows. A CHECK constraint backs it. Here is the test firing five requests at one seat: one joins, four wait. **Trade-off:** the UI polls every 4 seconds instead of WebSockets: one sleeping free-tier instance, no socket server on Vercel, ≤ 4 s latency is fine for 'driver arrived'. I'd move to SSE first if it mattered." | stateDiagram, `joinPool` code, race test output |
| 3:00–4:00 | Passenger flow | Nusrat logs in, picks Banani → Mohakhali, 1 seat, TeslaPay, sees "Up to 57.36 · 51.89 if pooled", requests, status Waiting. Rafiq requests Banani → Gulshan 1. | Two windows |
| 4:00–5:00 | Driver flow and pooling | Jashim goes online in Banani, sees both, accepts Nusrat: sweep pulls Rafiq in, "2 / 3". Shirin requests Gulshan 2 and auto-joins: "3 / 3, Bullet is full". Nusrat's screen shows Matched with Jashim · Bullet and 2 co-passengers, no names. Jashim taps Arrive: passengers flip to Driver arrived without refresh. Start: fares lock, Nusrat sees 51.89. | Split screen |
| 5:00–5:40 | Edge case, fare and status | A fourth passenger requests Gulshan 1 → stays Waiting. Complete: Nusrat `PAID` from wallet, Rafiq cash `PAID`, Shirin's 30 BDT wallet is short → `PENDING`, manifest shows cash due. Ride detail timeline shows every event. | Pool detail, ride detail |
| 5:40–6:00 | Deployment and process | "Deployed on Vercel, Render, Neon, all free; same image runs with `docker compose up`. Branches: features into master, pre-release for deploy fixes, release/v1.0.0 tagged." | Terminal, network graph |

Seed the state before recording so no time is spent on signup. Rehearse once with a timer.

## AI usage section (write it truthfully; adapt to what actually happened)

```
### AI usage
Tools: Claude Code (design review, scaffolding, test drafting), Cursor/Copilot (inline completion), official docs for NestJS, Prisma, Next.js, Render, Neon.

What for: turning the design notes into NestJS modules and DTOs; drafting e2e tests from the rule tables; Dockerfile and compose iteration; README wording. All architecture, schema, state-machine and matching decisions are documented in docs/ and were made before code was written.

Accepted suggestion: the AI proposed `SELECT … FOR UPDATE` on the pool row before checking free seats. I accepted the idea of serialising on the pool row but changed it to a single conditional UPDATE (`WHERE seats_taken + n <= capacity`), which gives the same lock with less code and no raw SQL, and added a CHECK constraint so the database enforces the invariant independently. The race test in test/capacity-race.e2e-spec.ts verifies it.

Rejected suggestion: the AI suggested protecting /passenger and /driver routes with Next.js middleware (proxy.ts). Rejected because the JWT is a Bearer token in localStorage which middleware cannot read; moving it to a cookie across the Vercel→Render origin boundary would require SameSite=None, CORS credentials and CSRF handling, and still fails under Safari's tracking prevention. A 30-line client-side RequireRole guard matches the API's token model.

Also rejected: upgrading to Prisma 7 (requires ESM and driver adapters; NestJS 11 emits CommonJS; Prisma 6 keeps directUrl which the Neon pooled/direct split needs) and adding Redis for matching locks (single database already serialises; the PRD forbids infrastructure added for show; listed as a scale-up path).

AI-drafted commits carry a Co-Authored-By trailer.
```

## Final submission checklist (Day 7 afternoon)

- [ ] Repo public; `master` default; `pre-release`, `release/v1.0.0`, tag `v1.0.0` pushed
- [ ] Deployed URL serves `release/v1.0.0`; `/health` returns ok; login works with demo credentials
- [ ] Fresh clone: `cp .env.example .env && docker compose up` → three healthy, app usable
- [ ] `pnpm --filter api test` and `test:e2e` green; race test run 20× locally
- [ ] README: every heading above present; every link clicked; every image renders on GitHub
- [ ] Video ≤ 6:00, linked at the top and in section 28
- [ ] No secrets: `git log --all --diff-filter=A --name-only --pretty=format: | sort -u | grep -Ei '(^|/)\.env$'` is empty
- [ ] Seed, tests, README, video all use Jashim / Bullet / Nusrat / Rafiq / Shirin
- [ ] Architecture diagram and ERD render on GitHub
- [ ] AI usage section written truthfully
- [ ] Viral-scale section present (bonus)
- [ ] You can explain every table, transition, and decision without notes (run through 12)
