# 05 — API Design

REST over HTTPS, JSON, Bearer JWT. Base path `/api/v1` (one prefix in `main.ts`; `/health` stays unprefixed for Render). Swagger UI at `/docs` in development and in the demo deployment.

## Conventions

| Topic | Rule |
|---|---|
| Resources | Nouns, plural: `/rides`, `/driver/pools`. Commands are `POST` sub-resources: `/driver/pools/:id/start` |
| Ids | UUID strings; zones use integers |
| Money | Integer paisa fields end in `Paisa` |
| Time | ISO 8601 UTC strings |
| Pagination | `?limit=20&offset=0`, max 50, history endpoints only |
| Success | `200` read, `201` create, `200` command (returns the updated resource) |
| Error body | `{ "code": "SCREAMING_SNAKE", "message": "human sentence" }` plus `details` array for validation |
| Auth header | `Authorization: Bearer <jwt>` |
| JWT payload | `{ sub: userId, role, iat, exp }`, 24 h |

## Error codes

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | DTO failed (details lists fields) |
| 400 | `SAME_ZONE` | pickup = dropoff |
| 401 | `UNAUTHENTICATED` | missing/invalid/expired token |
| 401 | `INVALID_CREDENTIALS` | login failed |
| 403 | `FORBIDDEN` | wrong role, or not the owner |
| 404 | `NOT_FOUND` | unknown id (only for ids the caller could own) |
| 409 | `EMAIL_TAKEN` | signup |
| 409 | `ACTIVE_RIDE_EXISTS` | passenger already has an active request |
| 409 | `INVALID_TRANSITION` | state machine says no (message names from → to) |
| 409 | `NO_VEHICLE` | driver has no vehicle |
| 409 | `DRIVER_OFFLINE` | action needs online driver |
| 409 | `DRIVER_HAS_ACTIVE_POOL` | accept while a pool is active |
| 409 | `ACTIVE_POOL_EXISTS` | go offline while a pool is active |
| 409 | `REQUEST_NOT_AVAILABLE` | accepted request is no longer `REQUESTED` |
| 409 | `SEATS_EXCEED_CAPACITY` | request seats > vehicle capacity |
| 429 | `RATE_LIMITED` | throttler |
| 500 | `INTERNAL` | anything else; logged with request id |

## Endpoints

### Health and public

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/health` | none | `{ status: 'ok', db: 'up', version }`; 503 if `SELECT 1` fails |
| GET | `/api/v1/zones` | none | `[{ id, name, lat, lng }]` |
| GET | `/api/v1/fare/estimate?pickupZoneId&dropoffZoneId&seats` | none | `{ distanceM, soloFarePaisa, pooledFarePaisa, seats, breakdown: { baseFarePaisa, distanceChargePaisa, poolDiscountPaisa } }` |

### Auth

| Method | Path | Body | Returns | Errors |
|---|---|---|---|---|
| POST | `/api/v1/auth/signup` | `{ email, password (≥ 8), fullName, role, vehicle?: { name, capacity } }` (`vehicle` required iff `role = DRIVER`) | `201 { token, user }` | `VALIDATION_ERROR`, `EMAIL_TAKEN` |
| POST | `/api/v1/auth/login` | `{ email, password }` | `{ token, user }` | `INVALID_CREDENTIALS` |
| GET | `/api/v1/auth/me` | — | `{ id, email, fullName, role, walletBalancePaisa, isOnline, vehicle? }` | `UNAUTHENTICATED` |

`user` never includes `passwordHash`. Use a response DTO or Prisma `select`.

### Passenger

| Method | Path | Body / query | Returns | Errors |
|---|---|---|---|---|
| POST | `/api/v1/rides` | `{ pickupZoneId, dropoffZoneId, seats, paymentMethod }` | `201 RideDetail` (with `pool` summary or `null`) | `SAME_ZONE`, `ACTIVE_RIDE_EXISTS`, `VALIDATION_ERROR` |
| GET | `/api/v1/rides` | `?limit&offset` | `{ items: RideSummary[], total }` newest first | — |
| GET | `/api/v1/rides/active` | — | `RideDetail` or `204` | — |
| GET | `/api/v1/rides/:id` | — | `RideDetail` incl. `events` | `FORBIDDEN`, `NOT_FOUND` |
| POST | `/api/v1/rides/:id/cancel` | — | `RideDetail` | `FORBIDDEN`, `INVALID_TRANSITION` |
| POST | `/api/v1/me/wallet/topup` (optional) | `{ amountPaisa 1..1_000_000 }` | `{ walletBalancePaisa }` | `VALIDATION_ERROR` |

`RideDetail` (passenger view):

```json
{
  "id": "…", "status": "MATCHED", "seats": 1, "paymentMethod": "TESLAPAY", "paymentStatus": null,
  "pickupZone": { "id": 1, "name": "Banani" }, "dropoffZone": { "id": 4, "name": "Mohakhali" },
  "distanceM": 1824, "estimatedFarePaisa": 5736, "pooledEstimatePaisa": 5189, "finalFarePaisa": null,
  "pool": { "id": "…", "status": "OPEN", "driverName": "Jashim Uddin", "vehicleName": "Bullet", "coPassengers": 1 },
  "events": [ { "type": "RIDE_REQUESTED", "at": "…" }, { "type": "RIDE_MATCHED", "at": "…" } ],
  "createdAt": "…", "updatedAt": "…"
}
```

`coPassengers` is a count. No other member data leaves the API on the passenger side.

### Driver

| Method | Path | Body / query | Returns | Errors |
|---|---|---|---|---|
| PATCH | `/api/v1/driver/status` | `{ online: boolean }` | `{ isOnline }` | `NO_VEHICLE`, `ACTIVE_POOL_EXISTS` |
| GET | `/api/v1/driver/requests` | `?pickupZoneId` (required) | `[{ id, passengerFirstName, pickupZone, dropoffZone, seats, createdAt }]` `REQUESTED` only, oldest first | `DRIVER_OFFLINE` |
| POST | `/api/v1/driver/pools` | `{ requestId }` | `201 PoolDetail` (after sweep) | `DRIVER_OFFLINE`, `DRIVER_HAS_ACTIVE_POOL`, `REQUEST_NOT_AVAILABLE`, `SEATS_EXCEED_CAPACITY` |
| GET | `/api/v1/driver/pools` | `?limit&offset` | `{ items: PoolSummary[], total }` | — |
| GET | `/api/v1/driver/pools/active` | — | `PoolDetail` or `204` | — |
| GET | `/api/v1/driver/pools/:id` | — | `PoolDetail` incl. members and events | `FORBIDDEN`, `NOT_FOUND` |
| POST | `/api/v1/driver/pools/:id/arrive` | — | `PoolDetail` | `FORBIDDEN`, `INVALID_TRANSITION` |
| POST | `/api/v1/driver/pools/:id/start` | — | `PoolDetail` (fares locked) | same |
| POST | `/api/v1/driver/pools/:id/complete` | — | `PoolDetail` (payments settled) | same |
| POST | `/api/v1/driver/pools/:id/cancel` | — | `PoolDetail` (members reverted) | same |

`PoolDetail` (driver view):

```json
{
  "id": "…", "status": "DRIVER_ARRIVED", "vehicleName": "Bullet", "capacity": 3, "seatsTaken": 3,
  "pickupZone": { "id": 1, "name": "Banani" },
  "members": [
    { "rideId": "…", "passengerName": "Nusrat Jahan", "seats": 1, "dropoffZone": "Mohakhali", "status": "DRIVER_ARRIVED", "farePaisa": 5189, "paymentMethod": "TESLAPAY", "paymentStatus": null },
    { "rideId": "…", "passengerName": "Rafiq Ahmed",  "seats": 1, "dropoffZone": "Gulshan 1", "status": "DRIVER_ARRIVED", "farePaisa": 5124, "paymentMethod": "CASH", "paymentStatus": null },
    { "rideId": "…", "passengerName": "Shirin Akter", "seats": 1, "dropoffZone": "Gulshan 2", "status": "DRIVER_ARRIVED", "farePaisa": 3942, "paymentMethod": "TESLAPAY", "paymentStatus": null }
  ],
  "events": [ … ],
  "createdAt": "…", "updatedAt": "…"
}
```

Before `IN_PROGRESS`, `farePaisa` is the pooled estimate (members ≥ 2) or solo estimate (1 member); after, it is `finalFarePaisa`. Label it in the UI.

## Guards and ownership

```
@UseGuards(JwtAuthGuard, RolesGuard) @Roles('PASSENGER')   // controller level for /rides
@UseGuards(JwtAuthGuard, RolesGuard) @Roles('DRIVER')      // controller level for /driver
```

Ownership is checked in the service on every `:id` route: load the row, compare `passengerId`/`driverId` with `user.sub`, throw `ForbiddenError` otherwise. Do it before any transition logic so a stranger never learns the state of a ride they do not own.

## Security in `main.ts` (one line each)

```ts
app.use(helmet());
app.enableCors({ origin: config.CORS_ORIGIN.split(','), credentials: false });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.useGlobalFilters(new DomainExceptionFilter());
app.setGlobalPrefix('api/v1', { exclude: ['health'] });
await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
```

`ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` globally; `@Throttle({ default: { limit: 10, ttl: 60_000 } })` on login/signup.

## Why REST and not GraphQL (README paragraph)

The API is six resources and eight commands. Commands (`arrive`, `start`, `complete`, `cancel`) map onto `POST` sub-resources that read like the state machine. There is one client with fixed views, so field selection buys nothing; the evaluator can exercise every path with curl in the video; Swagger comes free from the same DTO decorators used for validation. GraphQL would add a schema layer, resolver-level authorisation, and N+1 handling for members and events. Switch trigger: a second client (mobile) with materially different data needs.

## Logging

`nestjs-pino` with `autoLogging` gives one JSON line per request. Add `userId` to the log context in the JWT strategy. Log domain rejections at `warn` with the error `code`, unexpected errors at `error` with stack. Never log tokens, passwords, or full request bodies for auth routes.
