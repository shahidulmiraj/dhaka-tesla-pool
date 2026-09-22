# 12 — Interview Preparation

They will ask "why" about every choice and may ask you to change something live. Answers below are short and grounded in this design. Practise saying them; do not read them.

## Schema

**Why six tables and not more?**
Each answers a PRD sentence: users (actors), vehicles (Bullet's fixed capacity), zones (simple geography), ride_requests (what a passenger asked and where they are), pools (a vehicle's trip with a seat counter), ride_events (explain what happened). Payments live on the request because there is exactly one payment per ride; a `payments` table comes with refunds.

**Why is membership a `pool_id` column and not a join table?**
A request is in at most one pool at any time, so the relationship is many-to-one. The history "was in pool A, driver cancelled, joined pool B" is in `ride_events`, which carries both ids. A join table would be written once and read never.

**Why snapshot `capacity` and `vehicle_name` on the pool?**
The overbooking guarantee is a CHECK constraint, and a CHECK can only see its own row. Also, changing a vehicle later must not change a pool that is already running.

**Why a `seats_taken` counter instead of `SUM(seats)`?**
The CHECK constraint needs a column. The counter is maintained by exactly two functions, `joinPool` and `leavePool`, which are the only writers.

**Why partial unique indexes?**
"One active ride per passenger" and "one active pool per driver" are invariants the database can enforce. A double-submit becomes a `23505` that we map to `409`. No application lock needed.

**Why integer paisa?**
Exact arithmetic, trivial comparison, one unit everywhere. `numeric` is also exact but Prisma returns `Decimal` objects that need a library to add. Display converts in the browser with `Intl`.

**What can Prisma not express, and what did you do?**
CHECK constraints and partial unique indexes. `migrate dev --create-only`, hand-edit the SQL, commit it. `migrate deploy` replays it verbatim. Never `db push`.

## State machine

**Why two lifecycles?**
Arrive, start, complete happen once per vehicle, not once per passenger. Modelling them on the pool means one driver action, one transaction, and N member rows updated consistently. The passenger still sees the PRD's chain on their own row.

**Why `IN_PROGRESS` rather than `STARTED`?**
States are conditions, events are verbs. `POOL_STARTED` is the event; `IN_PROGRESS` is what is true afterwards.

**Why can passengers join at `DRIVER_ARRIVED`?**
That is the PRD story: Shirin grabs the last seat thirty seconds later while Jashim waits. Joining closes at `IN_PROGRESS`, when fares lock.

**Why do members go back to `REQUESTED` when a driver cancels?**
They did nothing wrong and keep their queue position. The alternative, cancelling them, makes the passenger re-enter the same request. Cost: one back-edge in the graph, driver-triggered only, logged as `RIDE_UNMATCHED`.

**How are invalid transitions rejected?**
A transition table (`Record<Status, Status[]>`) checked in the service, and the database write is `UPDATE … WHERE status = $from`. Zero rows means someone else moved it first, so we return `409 INVALID_TRANSITION`. The test iterates every pair in the table.

**What happens if the driver forgets to press "arrived"?**
`start` is rejected with 409 and a message naming the required transition. Strict chains are easier to test and reason about. If product wanted shortcuts, add `OPEN → IN_PROGRESS` to the table and the arrive event is synthesised; one line.

## Matching and fare

**What is the matching rule?**
Same pickup zone, seats fit, request still waiting, and the new dropoff is within 3 km of every existing member's dropoff. Mohakhali and Gulshan 1 are 1.56 km apart, so Nusrat and Rafiq pool. Uttara is 11 km from Mohakhali, so it does not.

**Where is it applied?**
One function, `joinPool`, two triggers: when a passenger requests (auto-join) and when a driver accepts (create pool, then sweep waiting requests in that zone). Same rule, same order of evaluation, so Rafiq requesting before or after Jashim accepts Nusrat ends the same way.

**What is wrong with the rule?**
It ignores direction and road geometry. A dropoff 2 km behind the pickup passes. At zone granularity in the Banani–Gulshan corridor it is acceptable; a real product uses route corridors and detour budgets.

**Compute Nusrat's fare.**
Haversine Banani→Mohakhali is 1 824 m. Distance charge `1824 × 1500 / 1000 = 2736`. Solo `3000 + 2736 = 5736` paisa. Pool discount `20 % of 2736 = 547`. Pooled `5189` paisa, 51.89 BDT.

**Why lock the fare at start and not at completion?**
Membership is frozen at start, so the number is identical either way. Locking at start lets the passenger see their fare during the ride and gives a clean invariant: `final_fare IS NOT NULL ⇔ status IN (IN_PROGRESS, COMPLETED)`, enforced by CHECK.

**Why does the discount count requests and not seats?**
One person booking three seats is not sharing. Two people sharing are. Documented assumption; the alternative is a two-line change.

## Concurrency

**Bullet has one seat left. Nusrat and Shirin click at the same time. What happens?**
Both transactions run `UPDATE pools SET seats_taken = seats_taken + 1 WHERE id = ? AND status IN (OPEN, DRIVER_ARRIVED) AND seats_taken + 1 <= capacity`. Postgres locks the row for the first. The second blocks, and when the first commits, the second re-evaluates its WHERE against the new row: `3 + 1 <= 3` is false, zero rows. Nusrat is matched, Shirin's request stays `REQUESTED`, both get 201. The CHECK constraint would reject an overbook even if the service were wrong.

**Why not `SELECT … FOR UPDATE`?**
It works, but it is a second statement and raw SQL through Prisma. The conditional update is the lock and the check in one statement. Same isolation level, less code.

**Why not `SERIALIZABLE`?**
It would work with retries but costs serialization failures under load for no gain; the conditional update already gives the guarantee at READ COMMITTED.

**Why not Redis or a distributed lock?**
One database already serialises the row. Redis would add a second source of truth to keep consistent and a failure mode. The PRD explicitly penalises infrastructure added for show. At regional scale, ownership by a matcher worker replaces locks anyway.

**Can two transactions deadlock?**
No: every path locks the pool row first (via its conditional update), then member rows in `created_at` order. Consistent ordering means no cycles.

**How did you test it?**
Five concurrent `POST /rides` against a real Postgres with one seat free. Exactly one has `pool_id` set, `seats_taken` is 3, four are waiting. Also two drivers accepting concurrently in the same zone: every request ends in exactly one pool. I ran the race file 20 times before trusting it.

**What changes at 1M users?**
Hot pools become lock queues; move joins behind an event bus into regional matcher workers that own their pools, so contention becomes ownership. Shard Postgres by city so a pool never spans databases. Keep the same conditional update inside each shard.

## Auth and security

**How is auth enforced?**
Bearer JWT, 24 h, bcrypt passwords. `JwtAuthGuard` authenticates, `RolesGuard` checks the role from the token, and services check ownership (`passengerId` or `driverId` equals the caller) before any logic, returning 403.

**Why 403 and not 404 for someone else's ride?**
UUIDs are not enumerable, so 403 leaks nothing useful, and the PRD's test reads "can't modify another user's ride". Consistency matters more than the choice.

**Why a token in localStorage and not an httpOnly cookie?**
Web and API are on different origins (Vercel, Render). A cross-site cookie needs `SameSite=None`, credentialed CORS, CSRF protection, and still breaks under Safari's tracking prevention. Trade-off: XSS exposure, mitigated by strict validation and no raw HTML rendering. Behind a shared origin I would switch to an httpOnly cookie with refresh tokens.

**What basic security is in place?**
`helmet`, CORS allow-list, DTO whitelisting that rejects unknown fields (so nobody posts `status: COMPLETED`), throttling on auth endpoints, no secrets in the repo, password hashes never serialised, structured logs without tokens.

## Frontend

**How do you handle loading, error, and empty states?**
One `AsyncState` component wraps every query: skeleton while pending, destructive alert with the API message and Retry on error, an `EmptyState` with a call to action when empty. Mutations disable their button, toast the server's message on 409, and invalidate the affected queries.

**Why polling?**
One free-tier instance that sleeps; no socket server on Vercel; 4 s latency is fine for "driver arrived". `refetchInterval` returns false on terminal states so completed rides stop polling. SSE is the first upgrade.

**Why client-side route guards instead of middleware?**
The token is not in a cookie, so middleware cannot see it. `RequireRole` reads the token in an effect (never during render, to avoid hydration mismatches), fetches `/auth/me`, and redirects by role.

## Process and tooling

**Why NestJS?**
The rubric scores validation, guards, logic placement, and organisation. NestJS gives modules, DI, pipes, guards, and filters, and mirrors ASP.NET Core, which I use in production. Express would need me to rebuild those conventions.

**Why Prisma 6 and not 7?**
Prisma 7 requires ESM, a config file, and driver adapters; NestJS 11 compiles to CommonJS. Prisma 6 keeps `directUrl`, which Neon's pooled/direct split needs. The upgrade is a day of friction with no evaluator value.

**Why REST?**
Six resources and eight commands with one client. Commands map to `POST` sub-resources that read like the state machine. Swagger is free from the same decorators. GraphQL adds a schema and resolver-level authorisation for no consumer that needs it.

**How did you use AI, and what did you reject?**
Scaffolding, tests from the rule tables, Docker iteration. Accepted the idea of serialising on the pool row but simplified `FOR UPDATE` to a conditional update. Rejected Next.js middleware for auth, Prisma 7, and Redis for matching, each for a concrete reason documented in the README.

**Show me the git history.**
Feature branches merged with `--no-ff` into master; `pre-release` carries the deploy fixes and docs; `release/v1.0.0` is tagged and is what runs in production. `git log --first-parent master` shows merges only after the scaffold.

## Live-change drills (practise each once before the interview)

1. **Add a cancellation fee of 10 BDT when cancelling after `DRIVER_ARRIVED`.** Where: `RidesService.cancel`, in the same transaction, deduct from wallet with the conditional update or record `PENDING`; add `cancellation_fee_paisa` to the request; event metadata. Test: cancel at `DRIVER_ARRIVED` → fee, at `MATCHED` → none.
2. **Make the discount tiered: 20 % for 2 members, 30 % for 3.** Where: `fare.ts` `poolDiscount(memberCount, distanceCharge)`; constants; the fare lock at `start` already passes the member count. Update the worked table and unit tests.
3. **Let a driver serve two zones.** Where: `GET /driver/requests` accepts `pickupZoneId[]`; matching rule unchanged because the pool's zone comes from the first request.
4. **Allow `OPEN → IN_PROGRESS` (skip arrive).** Where: add to `POOL_TRANSITIONS`, synthesise the `POOL_DRIVER_ARRIVED` event in `start`; the exhaustive transition test updates itself from the table.
5. **Add a `pool_members` history table.** Where: `joinPool`/`leavePool` insert/update rows; nothing else changes because those are the only writers. That is why they are the only writers.
6. **Explain a failing race test.** Look for a read-then-write on `seats_taken` outside the conditional update, or a `capacity` read from `vehicles` instead of the pool snapshot.

## Things to say when you do not know

"I did not implement that; here is where it would go and what it would touch." Then name the module and the test. That is a better answer than a guess.
