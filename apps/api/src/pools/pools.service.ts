import { Injectable, Logger } from '@nestjs/common';
import { Pool, PoolStatus, RideRequest } from '@prisma/client';
import { DomainError } from '../common/errors';
import { EventsService } from '../events/events.service';
import { finalFare, quote } from '../fare/fare';
import { PageQueryDto } from '../rides/rides.dto';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { zoneView } from '../zones/zones.service';
import { isDestinationCompatible } from './matching';
import { poolDetailView, poolSummaryView } from './pools.view';
import {
  ACTIVE_POOL_STATUSES,
  invalidTransition,
  JOINABLE_POOL_STATUSES,
  MEMBER_STATUS_FOR_POOL,
  poolSourcesOf,
} from './transitions';

export type JoinVia = 'ACCEPT' | 'SWEEP' | 'AUTO_JOIN';

const POOL_EVENT = {
  DRIVER_ARRIVED: 'POOL_DRIVER_ARRIVED',
  IN_PROGRESS: 'POOL_STARTED',
  COMPLETED: 'POOL_COMPLETED',
  CANCELLED: 'POOL_CANCELLED',
} as const satisfies Partial<Record<PoolStatus, string>>;

@Injectable()
export class PoolsService {
  private readonly logger = new Logger(PoolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async setOnline(driverId: string, online: boolean) {
    const driver = await this.prisma.user.findUniqueOrThrow({
      where: { id: driverId },
      include: { vehicle: true },
    });
    if (!driver.vehicle)
      throw new DomainError(
        'NO_VEHICLE',
        'Register a vehicle before going online',
      );
    if (!online) {
      const active = await this.prisma.pool.findFirst({
        where: { driverId, status: { in: ACTIVE_POOL_STATUSES } },
      });
      if (active) {
        throw new DomainError(
          'ACTIVE_POOL_EXISTS',
          'Finish or cancel your active pool before going offline',
        );
      }
    }
    await this.prisma.user.update({
      where: { id: driverId },
      data: { isOnline: online },
    });
    this.logger.log(
      { driverId, online },
      online ? 'DRIVER_ONLINE' : 'DRIVER_OFFLINE',
    );
    return { isOnline: online };
  }

  // "Relevant requests": waiting rides in the zone the driver chose, oldest first.
  async openRequests(driverId: string, pickupZoneId: number) {
    await this.assertOnline(driverId);
    const rides = await this.prisma.rideRequest.findMany({
      where: { pickupZoneId, status: 'REQUESTED' },
      include: { passenger: true, pickupZone: true, dropoffZone: true },
      orderBy: { createdAt: 'asc' },
    });
    return rides.map((r) => ({
      id: r.id,
      passengerFirstName: r.passenger.fullName.split(' ')[0],
      pickupZone: { id: r.pickupZone.id, name: r.pickupZone.name },
      dropoffZone: { id: r.dropoffZone.id, name: r.dropoffZone.name },
      seats: r.seats,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Trigger A: a passenger requests. Try joinable pools in the pickup zone,
   * fullest first (vehicles leave sooner), and stop at the first join.
   */
  async autoJoin(tx: Tx, request: RideRequest) {
    const candidates = await tx.pool.findMany({
      where: {
        pickupZoneId: request.pickupZoneId,
        status: { in: JOINABLE_POOL_STATUSES },
      },
      orderBy: [{ seatsTaken: 'desc' }, { createdAt: 'asc' }],
    });
    for (const pool of candidates) {
      if (pool.seatsTaken + request.seats > pool.capacity) continue; // cheap pre-filter; joinPool re-checks
      if (await this.joinPool(tx, pool, request, null, 'AUTO_JOIN'))
        return pool.id;
    }
    return null;
  }

  /**
   * Trigger B: the driver accepts a request. Creates the pool, joins the accepted
   * request, then sweeps other waiting requests in the zone through joinPool.
   */
  async accept(driverId: string, requestId: string) {
    const poolId = await this.prisma.$transaction(async (tx) => {
      const driver = await tx.user.findUniqueOrThrow({
        where: { id: driverId },
        include: { vehicle: true },
      });
      if (!driver.vehicle)
        throw new DomainError(
          'NO_VEHICLE',
          'Register a vehicle before accepting rides',
        );
      if (!driver.isOnline)
        throw new DomainError('DRIVER_OFFLINE', 'Go online to accept requests');
      const active = await tx.pool.findFirst({
        where: { driverId, status: { in: ACTIVE_POOL_STATUSES } },
      });
      if (active)
        throw new DomainError(
          'DRIVER_HAS_ACTIVE_POOL',
          'You already have an active pool',
        );

      const request = await tx.rideRequest.findUnique({
        where: { id: requestId },
      });
      if (!request || request.status !== 'REQUESTED') {
        throw new DomainError(
          'REQUEST_NOT_AVAILABLE',
          'This request is no longer waiting for a driver',
        );
      }
      if (request.seats > driver.vehicle.capacity) {
        throw new DomainError(
          'SEATS_EXCEED_CAPACITY',
          `${request.seats} seats requested; ${driver.vehicle.name} has ${driver.vehicle.capacity}`,
        );
      }

      // Partial unique index pools_one_active_per_driver backs the check above.
      const pool = await tx.pool.create({
        data: {
          driverId,
          vehicleId: driver.vehicle.id,
          vehicleName: driver.vehicle.name,
          capacity: driver.vehicle.capacity,
          pickupZoneId: request.pickupZoneId,
        },
      });
      await this.events.record(tx, {
        type: 'POOL_CREATED',
        poolId: pool.id,
        to: 'OPEN',
        actorUserId: driverId,
        metadata: {
          capacity: pool.capacity,
          vehicleName: pool.vehicleName,
          acceptedRequestId: request.id,
        },
      });
      if (!(await this.joinPool(tx, pool, request, driverId, 'ACCEPT'))) {
        // Someone cancelled or took it a moment ago: roll back, no orphan pool.
        throw new DomainError(
          'REQUEST_NOT_AVAILABLE',
          'This request is no longer waiting for a driver',
        );
      }
      await this.sweep(tx, pool);
      return pool.id;
    });
    return this.detail(driverId, poolId);
  }

  // Pull compatible waiting requests into a new pool, oldest first, until full.
  // One candidate at a time, FOR UPDATE SKIP LOCKED: a row another driver's sweep
  // holds is skipped instead of waited on (no deadlock between two sweeps), and we
  // never lock rows we will not take, so the other sweep can still fill its seats.
  private async sweep(tx: Tx, pool: Pool) {
    const tried: string[] = [];
    for (;;) {
      const { seatsTaken } = await tx.pool.findUniqueOrThrow({
        where: { id: pool.id },
      });
      const free = pool.capacity - seatsTaken;
      if (free <= 0) return;
      const [next] = await tx.$queryRaw<
        Pick<RideRequest, 'id' | 'seats' | 'dropoffZoneId'>[]
      >`
        SELECT id, seats, dropoff_zone_id AS "dropoffZoneId" FROM ride_requests
        WHERE pickup_zone_id = ${pool.pickupZoneId} AND status = 'REQUESTED' AND pool_id IS NULL
          AND seats <= ${free} AND id <> ALL(${tried}::uuid[])
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED`;
      if (!next) return;
      tried.push(next.id);
      await this.joinPool(tx, pool, next, null, 'SWEEP'); // false = incompatible destination
    }
  }

  async list(driverId: string, page: PageQueryDto) {
    const where = { driverId };
    const [items, total] = await Promise.all([
      this.prisma.pool.findMany({
        where,
        include: { pickupZone: true, _count: { select: { members: true } } },
        orderBy: { createdAt: 'desc' },
        take: page.limit,
        skip: page.offset,
      }),
      this.prisma.pool.count({ where }),
    ]);
    return { items: items.map(poolSummaryView), total };
  }

  async active(driverId: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { driverId, status: { in: ACTIVE_POOL_STATUSES } },
      select: { id: true },
    });
    return pool ? this.detail(driverId, pool.id) : null;
  }

  async detail(driverId: string, poolId: string) {
    const pool = await this.prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        pickupZone: true,
        members: {
          include: { passenger: true, dropoffZone: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!pool) throw new DomainError('NOT_FOUND', 'Pool not found');
    if (pool.driverId !== driverId)
      throw new DomainError('FORBIDDEN', 'This pool is not yours');
    const events = await this.prisma.rideEvent.findMany({
      where: { poolId },
      orderBy: { id: 'asc' },
    });
    return poolDetailView(pool, events);
  }

  // Driver commands. Each is one transaction: the pool's conditional update takes
  // the row lock first, then member rows cascade. 0 rows -> 409, nothing else runs.
  arrive(driverId: string, poolId: string) {
    return this.command(driverId, poolId, 'DRIVER_ARRIVED', async (tx) => {
      await tx.rideRequest.updateMany({
        where: { poolId, status: 'MATCHED' },
        data: { status: 'DRIVER_ARRIVED' },
      });
    });
  }

  // Fares lock here: membership is frozen from IN_PROGRESS, so the number is final.
  start(driverId: string, poolId: string) {
    return this.command(driverId, poolId, 'IN_PROGRESS', async (tx) => {
      const members = await tx.rideRequest.findMany({
        where: { poolId },
        orderBy: { createdAt: 'asc' },
      });
      for (const m of members) {
        const fare = finalFare(quote(m.distanceM, m.seats), members.length);
        await this.cascade(tx, m.id, 'DRIVER_ARRIVED', {
          status: 'IN_PROGRESS',
          finalFarePaisa: fare,
        });
        await this.events.record(tx, {
          type: 'FARE_LOCKED',
          rideRequestId: m.id,
          poolId,
          actorUserId: driverId,
          metadata: {
            finalFarePaisa: fare,
            members: members.length,
            pooled: members.length >= 2,
          },
        });
      }
    });
  }

  complete(driverId: string, poolId: string) {
    return this.command(driverId, poolId, 'COMPLETED', async (tx) => {
      const members = await tx.rideRequest.findMany({
        where: { poolId },
        orderBy: { createdAt: 'asc' },
      });
      for (const m of members) {
        const payment = await this.settle(tx, m);
        await this.cascade(tx, m.id, 'IN_PROGRESS', {
          status: 'COMPLETED',
          paymentStatus: payment.status,
        });
        await this.events.record(tx, {
          type: 'PAYMENT_SETTLED',
          rideRequestId: m.id,
          poolId,
          actorUserId: driverId,
          metadata: {
            method: m.paymentMethod,
            farePaisa: m.finalFarePaisa,
            ...payment,
          },
        });
      }
    });
  }

  // Driver cancel: members did nothing wrong, so they go back to REQUESTED and keep
  // their queue position (created_at unchanged), immediately eligible for other pools.
  cancel(driverId: string, poolId: string) {
    return this.command(driverId, poolId, 'CANCELLED', async (tx) => {
      const members = await tx.rideRequest.findMany({
        where: { poolId },
        orderBy: { createdAt: 'asc' },
      });
      for (const m of members) {
        await this.cascade(tx, m.id, m.status, {
          status: 'REQUESTED',
          poolId: null,
        });
        await this.events.record(tx, {
          type: 'RIDE_UNMATCHED',
          rideRequestId: m.id,
          poolId, // the old pool, so history explains the revert
          from: m.status,
          to: 'REQUESTED',
          actorUserId: driverId,
          metadata: { reason: 'POOL_CANCELLED_BY_DRIVER', seats: m.seats },
        });
      }
    });
  }

  /**
   * The ONLY writer that takes a request out of a pool (passenger cancel).
   * Locks the pool first (conditional update, joinable only), then the member.
   * Returns false if the pool has already started (caller answers 409).
   * If the last member leaves, the system cancels the now-empty pool.
   */
  async leavePool(
    tx: Tx,
    ride: RideRequest,
    passengerId: string,
  ): Promise<boolean> {
    const poolId = ride.poolId!;
    const freed = await tx.pool.updateMany({
      where: { id: poolId, status: { in: JOINABLE_POOL_STATUSES } },
      data: { seatsTaken: { decrement: ride.seats } },
    });
    if (freed.count === 0) return false;

    const current = await tx.rideRequest.findUniqueOrThrow({
      where: { id: ride.id },
    });
    const left = await tx.rideRequest.updateMany({
      where: {
        id: ride.id,
        poolId,
        status: { in: ['MATCHED', 'DRIVER_ARRIVED'] },
      },
      data: { status: 'CANCELLED', poolId: null, cancelledBy: 'PASSENGER' },
    });
    if (left.count !== 1)
      throw invalidTransition('Ride', current.status, 'CANCELLED');
    await this.events.record(tx, {
      type: 'RIDE_CANCELLED',
      rideRequestId: ride.id,
      poolId,
      from: current.status,
      to: 'CANCELLED',
      actorUserId: passengerId,
      metadata: { cancelledBy: 'PASSENGER', seatsFreed: ride.seats },
    });

    const pool = await tx.pool.findUniqueOrThrow({ where: { id: poolId } });
    if (pool.seatsTaken === 0) {
      const from = await this.move(tx, poolId, 'CANCELLED', {});
      await this.events.record(tx, {
        type: 'POOL_CANCELLED',
        poolId,
        from,
        to: 'CANCELLED',
        actorUserId: null,
        metadata: { reason: 'EMPTY', cancelledBy: 'SYSTEM' },
      });
    }
    return true;
  }

  // Simulated payment. TeslaPay debits only if the wallet covers the fare
  // (conditional update + CHECK >= 0); otherwise cash is due. Never blocks completion.
  private async settle(tx: Tx, m: RideRequest) {
    const fare = m.finalFarePaisa!;
    if (m.paymentMethod === 'CASH') return { status: 'PAID' as const };
    const debit = await tx.user.updateMany({
      where: { id: m.passengerId, walletBalancePaisa: { gte: fare } },
      data: { walletBalancePaisa: { decrement: fare } },
    });
    const { walletBalancePaisa: after } = await tx.user.findUniqueOrThrow({
      where: { id: m.passengerId },
    });
    return debit.count === 1
      ? {
          status: 'PAID' as const,
          walletBefore: after + fare,
          walletAfter: after,
        }
      : {
          status: 'PENDING' as const,
          walletBefore: after,
          walletAfter: after,
          cashDue: true,
        };
  }

  private async command(
    driverId: string,
    poolId: string,
    to: keyof typeof POOL_EVENT,
    cascade: (tx: Tx) => Promise<void>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const pool = await tx.pool.findUnique({ where: { id: poolId } });
      if (!pool) throw new DomainError('NOT_FOUND', 'Pool not found');
      if (pool.driverId !== driverId)
        throw new DomainError('FORBIDDEN', 'This pool is not yours');
      const from = await this.move(
        tx,
        poolId,
        to,
        to === 'CANCELLED' ? { seatsTaken: 0 } : {},
      );
      if (!from) {
        const now = await tx.pool.findUniqueOrThrow({ where: { id: poolId } });
        throw invalidTransition('Pool', now.status, to);
      }
      await this.events.record(tx, {
        type: POOL_EVENT[to],
        poolId,
        from,
        to,
        actorUserId: driverId,
        metadata:
          to === 'CANCELLED' ? { reason: 'DRIVER', cancelledBy: 'DRIVER' } : {},
      });
      await cascade(tx);
    });
    return this.detail(driverId, poolId);
  }

  // Conditional update from each allowed source status in turn; returns the
  // status actually moved from, or null if the state machine says no.
  private async move(
    tx: Tx,
    poolId: string,
    to: PoolStatus,
    extra: { seatsTaken?: number },
  ) {
    for (const from of poolSourcesOf(to)) {
      const res = await tx.pool.updateMany({
        where: { id: poolId, status: from },
        data: { status: to, ...extra },
      });
      if (res.count === 1) return from;
    }
    return null;
  }

  // A member row that is not in the expected status means the invariants broke:
  // throw so the whole transaction rolls back rather than half-cascading.
  private async cascade(
    tx: Tx,
    rideId: string,
    expected: RideRequest['status'],
    data: Partial<
      Pick<
        RideRequest,
        'status' | 'finalFarePaisa' | 'paymentStatus' | 'poolId'
      >
    >,
  ) {
    const res = await tx.rideRequest.updateMany({
      where: { id: rideId, status: expected },
      data,
    });
    if (res.count !== 1)
      throw new Error(`Member ${rideId} was not ${expected}`);
  }

  /**
   * The ONLY writer of ride_requests.pool_id (on join) and pools.seats_taken (up).
   * Runs inside the caller's transaction; returns false when the request cannot join.
   *
   * 1. Conditional UPDATE on the pool row: Postgres row-locks it, and a concurrent
   *    joiner blocks, then re-evaluates the WHERE against the new seats_taken
   *    (READ COMMITTED) and updates 0 rows. CHECK (seats_taken <= capacity) backs it.
   * 2. Holding that lock, re-check the destination rule against the members as
   *    they are now, so two incompatible passengers cannot slip in together.
   * 3. Conditional UPDATE on the request (still REQUESTED, no pool).
   * A failed step 2 or 3 gives the seats back in the same transaction.
   */
  async joinPool(
    tx: Tx,
    pool: Pick<Pool, 'id' | 'capacity'>,
    request: Pick<RideRequest, 'id' | 'seats' | 'dropoffZoneId'>,
    actorUserId: string | null,
    via: JoinVia,
  ): Promise<boolean> {
    const seat = await tx.pool.updateMany({
      where: {
        id: pool.id,
        status: { in: JOINABLE_POOL_STATUSES },
        seatsTaken: { lte: pool.capacity - request.seats }, // capacity is an immutable snapshot
      },
      data: { seatsTaken: { increment: request.seats } },
    });
    if (seat.count === 0) return false;

    const locked = await tx.pool.findUniqueOrThrow({ where: { id: pool.id } });
    const [dropoff, members] = await Promise.all([
      tx.zone.findUniqueOrThrow({ where: { id: request.dropoffZoneId } }),
      tx.rideRequest.findMany({
        where: { poolId: pool.id, id: { not: request.id } },
        include: { dropoffZone: true },
      }),
    ]);
    const compatible = isDestinationCompatible(
      zoneView(dropoff),
      members.map((m) => zoneView(m.dropoffZone)),
    );
    const status = MEMBER_STATUS_FOR_POOL[locked.status]!; // OPEN -> MATCHED, DRIVER_ARRIVED -> DRIVER_ARRIVED
    const joined =
      compatible &&
      (
        await tx.rideRequest.updateMany({
          where: { id: request.id, status: 'REQUESTED', poolId: null },
          data: { poolId: pool.id, status },
        })
      ).count === 1;
    if (!joined) {
      await tx.pool.update({
        where: { id: pool.id },
        data: { seatsTaken: { decrement: request.seats } },
      });
      return false;
    }
    await this.events.record(tx, {
      type: 'RIDE_MATCHED',
      rideRequestId: request.id,
      poolId: pool.id,
      from: 'REQUESTED',
      to: status,
      actorUserId,
      metadata: {
        seats: request.seats,
        via,
        seatsTaken: locked.seatsTaken,
        capacity: locked.capacity,
      },
    });
    return true;
  }

  private async assertOnline(driverId: string) {
    const driver = await this.prisma.user.findUniqueOrThrow({
      where: { id: driverId },
    });
    if (!driver.isOnline)
      throw new DomainError(
        'DRIVER_OFFLINE',
        'Go online to see and accept requests',
      );
  }
}
