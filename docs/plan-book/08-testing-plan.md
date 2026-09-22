# 08 — Testing Plan

The PRD names six behaviours. Test those first, exhaustively, against a real database. Coverage percentage is not a goal.

## Setup

| Item | Choice |
|---|---|
| Runner | Jest (NestJS default), `ts-jest` |
| HTTP | `supertest` against `app.getHttpServer()` with the full module graph (guards, pipes, filters included) |
| Database | `tesla_pool_test` in the Compose `db` container (created by `docker/init-test-db.sql`). `TEST_DATABASE_URL` in `apps/api/.env` |
| Global setup | `test/global-setup.ts`: run `prisma migrate deploy` against `TEST_DATABASE_URL` |
| Per-file | `beforeEach`: `TRUNCATE ride_events, ride_requests, pools, vehicles, users RESTART IDENTITY CASCADE`; seed zones once in global setup (they are immutable) |
| Fixtures | `test/cast.ts`: `createJashim(app)`, `createNusrat(app)`, `createRafiq(app)`, `createShirin(app)` each signs up via the API and returns `{ token, user }`; `zone('Banani')` looks up ids |
| Scripts | `test` → unit (`src/**/*.spec.ts`); `test:e2e` → `test/**/*.e2e-spec.ts` with `--runInBand` (shared DB) |

Never mock Prisma in e2e tests. The capacity and concurrency tests are only meaningful against PostgreSQL.

## Unit tests (pure functions)

### `fare.spec.ts`
- `haversineM(Banani, Mohakhali) === 1824`, `(Banani, Gulshan 1) === 1770`, `(Banani, Gulshan 2) === 785`, `(Mohakhali, Gulshan 1) === 1560`.
- `quote(1824, 1)` → `{ distanceCharge: 2736, solo: 5736, pooled: 5189 }`.
- `quote(1770, 1)` → `{ 2655, 5655, 5124 }`.
- Seats multiply: `quote(1824, 2).solo === 11472`.
- Rounding: pick a distance where `× 1.5` ends in `.5` and assert `Math.round` behaviour explicitly (e.g. `distance_m = 1` → `distanceCharge = 2`).
- Discount when alone is 0: `finalFare(quote, members = 1) === solo`.

### `transitions.spec.ts`
- For every `(from, to)` pair in `RideStatus × RideStatus`, `canTransition(from, to)` equals membership in `RIDE_TRANSITIONS[from]`. Same for pools. This is generated with two nested loops, not hand-written cases, so it is exhaustive by construction.
- `MEMBER_STATUS_FOR_POOL` covers every `PoolStatus`.

### `matching.spec.ts`
- `isDestinationCompatible(newZone, memberZones, 3000)`: Mohakhali vs [Gulshan 1] → true; Gulshan 2 vs [Mohakhali, Gulshan 1] → true; Uttara vs [Mohakhali] → false; Farmgate vs [Mohakhali] → true (2562, borderline); empty members → true.
- `fits(seatsTaken 2, capacity 3, seats 1)` → true; `(2, 3, 2)` → false.

## E2E tests: the six PRD behaviours

### 1. Bullet's capacity can never be exceeded — `capacity.e2e-spec.ts`
- Jashim online in Banani. Nusrat, Rafiq, Shirin request compatible trips → all three join Bullet after Jashim accepts Nusrat (sweep). `seatsTaken === 3`.
- A fourth passenger (Tania → Gulshan 1) requests → `201`, `pool === null`, status `REQUESTED`.
- Passenger requesting 2 seats when 1 is free → `pool === null`.
- Direct DB attempt: `UPDATE pools SET seats_taken = 4` via `$executeRaw` → rejects with the CHECK violation. This shows the database layer alone holds the line.

### 2. Invalid state transitions are rejected — `transitions.e2e-spec.ts`
- `start` from `OPEN` → `409 INVALID_TRANSITION`.
- `complete` from `DRIVER_ARRIVED` → `409`.
- `arrive` twice → second `409`.
- `cancel` pool from `IN_PROGRESS` → `409`.
- Passenger `cancel` from `IN_PROGRESS` → `409`; from `COMPLETED` → `409`.
- Happy path `arrive → start → complete` → `200` each, member statuses cascade (`DRIVER_ARRIVED`, `IN_PROGRESS`, `COMPLETED`), events recorded in order.

### 3. Nusrat's and Rafiq's pooled fares calculate correctly — `fare.e2e-spec.ts`
- Estimate endpoint: `GET /fare/estimate?pickupZoneId=Banani&dropoffZoneId=Mohakhali&seats=1` → `soloFarePaisa 5736, pooledFarePaisa 5189`.
- After `POST /rides`, `estimatedFarePaisa === 5736` (Nusrat), `5655` (Rafiq).
- After `start` with both in Bullet: `finalFarePaisa` 5189 and 5124 respectively; each passenger's `GET /rides/:id` shows only their own.
- Solo pool (only Nusrat) started → `finalFarePaisa === 5736` (no discount).
- Shirin (TeslaPay, wallet 3000, fare 3942) after `complete` → `paymentStatus PENDING`, wallet unchanged. Nusrat (wallet 50000) → `PAID`, wallet `44811`. Rafiq (cash) → `PAID`.

### 4. Users can't modify another user's ride — `ownership.e2e-spec.ts`
- Rafiq `GET /rides/:nusratRideId` → `403 FORBIDDEN`; `POST /rides/:nusratRideId/cancel` → `403`.
- Kamal (second driver) `GET /driver/pools/:jashimPoolId` → `403`; `POST …/start` → `403`.
- Nusrat calls `POST /driver/pools` → `403` (role guard). Jashim calls `POST /rides` → `403`.
- No token → `401 UNAUTHENTICATED`.
- Body smuggling: `POST /rides` with `status: 'COMPLETED'` in the body → `400 VALIDATION_ERROR`.

### 5. Cancellation rules hold — `cancellation.e2e-spec.ts`
- Nusrat cancels from `REQUESTED` → `CANCELLED`, `cancelledBy PASSENGER`.
- Nusrat cancels from `MATCHED` (in Bullet with Rafiq) → seat freed (`seatsTaken 1`), pool still `OPEN`, event `RIDE_CANCELLED`.
- Rafiq then cancels (last member) → pool `CANCELLED`, `cancelledBy` on the pool event is `SYSTEM`, Jashim can accept again.
- Driver cancels a pool with two members → pool `CANCELLED`; both requests `REQUESTED`, `poolId null`, events `RIDE_UNMATCHED`; another driver's accept sweeps them in.
- Nusrat cancels after `DRIVER_ARRIVED` → allowed. After `IN_PROGRESS` → `409`.
- Second `POST /rides` while one is active → `409 ACTIVE_RIDE_EXISTS`.

### 6. Two concurrent requests can't corrupt pool capacity — `capacity-race.e2e-spec.ts`
```ts
// Bullet: capacity 3, Nusrat + Rafiq already in (seatsTaken 2). Five passengers race for the last seat.
const racers = await Promise.all([shirin, tania, farhan, mim, sabbir].map(p => signUp(app, p)));
const results = await Promise.all(racers.map(r =>
  request(app.getHttpServer()).post('/api/v1/rides').set(auth(r.token))
    .send({ pickupZoneId: banani, dropoffZoneId: gulshan2, seats: 1, paymentMethod: 'CASH' })));
results.forEach(res => expect(res.status).toBe(201));
const joined = results.filter(r => r.body.pool?.id === pool.id);
expect(joined).toHaveLength(1);
const dbPool = await prisma.pool.findUnique({ where: { id: pool.id } });
expect(dbPool.seatsTaken).toBe(3);
const waiting = await prisma.rideRequest.count({ where: { status: 'REQUESTED', poolId: null } });
expect(waiting).toBe(4);
```
- Repeat with `seats_taken 0` and five racers: exactly three join, two wait.
- Repeat on the driver path: two drivers (Jashim, Kamal) accept two different waiting requests concurrently in the same zone with three more waiting → every request ends in exactly one pool; `SUM(seats)` per pool equals `seatsTaken`.

Run this file at least 20 times locally (`for i in $(seq 20); do pnpm test:e2e -t race; done`) before trusting it; a race test that passes once proves little.

## Additional e2e (cheap, catch regressions)

- `auth.e2e-spec.ts`: signup → login → me; duplicate email in different case → `409 EMAIL_TAKEN`; wrong password → `401`; driver signup without vehicle → `400`.
- `driver-status.e2e-spec.ts`: offline driver `GET /driver/requests` → `409 DRIVER_OFFLINE`; go offline with active pool → `409 ACTIVE_POOL_EXISTS`; requests list filtered by zone and only `REQUESTED`.
- `history.e2e-spec.ts`: after a full trip, `GET /rides` shows one `COMPLETED` item for each passenger; `GET /driver/pools` shows one; events on both detail endpoints tell the story in order.
- `seed.spec.ts` (unit-ish, real DB): run `seed()` twice → same row counts.

## What is deliberately not tested

- Frontend components (stated in README; logic is server-side; UI is shown in the video).
- Swagger output, logging format.
- Load or performance.

## Test commands in README

```
docker compose up -d db
pnpm --filter api test          # unit
pnpm --filter api test:e2e      # needs db; uses tesla_pool_test
```

Keep a screenshot of the e2e run with the race test green for the README and the video.
