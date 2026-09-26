# Demo video script (≤ 6:00)

Speaker notes for the PRD's six-minute video. Speak from the bullets in your own words; do not read it aloud verbatim.
About 800 spoken words; timings leave ~10 s of slack.

## Before recording

1. Reset to the seeded state: `docker compose down -v && docker compose up --build -d`, wait for three healthy
   containers (`docker compose ps`).
2. Browser windows (each browser keeps one login):
   - Chrome: Jashim (driver)
   - Chrome incognito: Nusrat
   - Firefox: Rafiq, then sign out and sign in as Shirin
3. Tabs: README §5 Architecture, README §6 ERD, `apps/api/src/pools/pools.service.ts` at `joinPool`, a terminal with
   `pnpm --filter api exec jest --config test/jest-e2e.json --runInBand test/capacity-race`, the GitHub network graph.
4. OBS, 1080p (Loom free stops at 5 minutes). One rehearsal with a timer.

## 0:00–1:00 · Problem, users, core idea

**Show:** README top, then the cast table (§18).

> It's 8:41 in Banani. Jashim's battery rickshaw, Bullet, has three seats, and he'd rather not leave with two empty.
> Nusrat is going to Mohakhali, Rafiq to Gulshan 1; both would pay less to share, but not by negotiating with
> strangers. So the system has four jobs: decide in a second whether trips are compatible; guarantee three seats never
> become four, even when two people grab the last one at the same moment; show each passenger only their own fare and
> status; and keep a history that explains every ride. I built it around three things: the passenger, the driver with
> a fixed-capacity vehicle, and the pool that ties them together.

## 1:00–2:00 · Architecture, backend, frontend, database

**Show:** the architecture diagram, then the ERD.

> Next.js in the browser, a NestJS REST API, PostgreSQL. Three Docker containers locally, the same API image on Render.
> No Redis, no queue: the database already solves the hard problem. NestJS because what is judged here, validation,
> guards and where business logic lives, maps onto its structure: thin controllers, rules in services, pure functions
> for fares and transitions.
>
> Six tables: users, vehicles and zones are the actors and the map; `ride_requests` is the passenger's side, `pools`
> one vehicle's trip, `ride_events` an append-only history. Membership is just a `pool_id` on the request, because a
> request is only in one pool at a time. And the pool copies the vehicle's capacity, because a CHECK constraint can
> only see its own row.

## 2:00–3:00 · Lifecycle, one key decision, one trade-off

**Show:** the two state diagrams (README §7), `joinPool`, then run the race test.

> Two lifecycles, not one. The pool goes OPEN → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED, and every passenger moves
> with it in one transaction. STARTED became IN_PROGRESS: "started" is the event, "in progress" is the state.
>
> **Key decision:** claiming a seat is one conditional UPDATE: add my seats *where* seats-taken plus mine is at most
> the capacity. When Nusrat and Shirin race for the last seat, Postgres locks the pool row; the second waits, re-checks
> the condition against the new count, and updates zero rows, so she keeps waiting for the next Tesla. A CHECK
> constraint backs it in the database. *(run it)* Five passengers fire at Bullet's last seat at once: one gets in,
> four wait. Twenty runs in a row, green.
>
> **Trade-off:** the app polls every four seconds instead of WebSockets. A free-tier server that sleeps can't hold
> sockets reliably, and four seconds is fine for "your driver arrived". If it had to be instant, Server-Sent Events
> first.

## 3:00–4:00 · Passenger flow

**Show:** Nusrat's window, then Firefox.

- Nusrat picks Banani → Mohakhali, 1 seat, TeslaPay.
  > Before booking she sees three prices: 57.36 taka alone, 49.15 if three share, 43.68 at the maximum discount. The
  > discount grows with the pool: 20 % of the distance charge for two riders, 30 % for three, up to 50 %. The base fare
  > never changes. You can check every number by hand in the README.
- Request: the card says *Looking for a Tesla*.
- Firefox, Rafiq: Banani → Gulshan 1, cash.
  > Rafiq's trip overlaps hers without being the same: his drop-off is 1.5 km from hers, inside the 3 km rule.

## 4:00–5:00 · Driver flow and pooling

**Show:** Jashim's window, then Nusrat's.

- Jashim goes **Online**, serving Banani. Both requests show, first names only. Point at the **Going to** filter:
  > He can also filter by destination to pick riders going his way.
- **Accept** Nusrat:
  > Accepting creates the pool and pulls in every compatible waiting request, so Rafiq is in too: two of three.
- Firefox: sign out Rafiq, sign in Shirin, request Banani → Gulshan 2 with TeslaPay.
  > Shirin grabs the last seat herself: auto-joined into the open pool by the same function and the same rule.
- Manifest: **3 / 3, Bullet is full**, fares 49.15 / 48.58 / 38.25, marked *estimate*.
- Nusrat's window:
  > She sees "Jashim · Bullet · 2 co-passengers": a count, no names.
- **Mark arrived**: Nusrat's screen flips by itself within four seconds. **Start trip**:
  > Fares lock now, because nobody can join or leave a moving vehicle. Three riders, 30 % off: Nusrat pays 49.15.

## 5:00–5:40 · Edge case, fare and status

**Show:** Jashim's manifest, then Nusrat's ride detail.

- **Complete trip.**
  > Nusrat paid from her wallet: 500 down to 450.85. Rafiq paid cash. Shirin has only 30 taka on TeslaPay against a
  > 38.25 fare, so the trip still completes and the manifest shows *cash due*. A payment problem never traps the
  > driver. And Jashim now serves Mohakhali, where the trip ended.
- Nusrat's ride detail, point at the timeline:
  > Every step is recorded, so if anyone asks later what happened, the answer is on screen.

## 5:40–6:00 · Deployment and process

**Show:** `docker compose ps`, then the GitHub network graph.

> One `docker compose up`: three healthy containers, and the database migrates and seeds itself on boot.
> *(If deployed: "and it's live on Vercel, Render and Neon, all free tiers.")* The history shows feature branches
> merged into master, a pre-release branch for release fixes, and a tagged release. Thanks for watching.

## If you run long

Trim 2:00–3:00 first. Keep the race test and Shirin's cash-due moment: they are what evaluators remember.
Upload unlisted to YouTube with these chapters in the description, then add the link to README (top and §28).
