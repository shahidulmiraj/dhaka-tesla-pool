import { Injectable, Logger } from '@nestjs/common';
import { Pool, RideRequest } from '@prisma/client';
import { DomainError } from '../common/errors';
import { EventsService } from '../events/events.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { zoneView } from '../zones/zones.service';
import { isDestinationCompatible } from './matching';
import {
  ACTIVE_POOL_STATUSES,
  JOINABLE_POOL_STATUSES,
  MEMBER_STATUS_FOR_POOL,
} from './transitions';

export type JoinVia = 'ACCEPT' | 'SWEEP' | 'AUTO_JOIN';

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
