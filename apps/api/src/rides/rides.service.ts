import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/errors';
import { EventsService } from '../events/events.service';
import { ACTIVE_RIDE_STATUSES, invalidTransition } from '../pools/transitions';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { ZonesService } from '../zones/zones.service';
import { CreateRideDto, PageQueryDto } from './rides.dto';
import { rideDetailView, rideSummaryView } from './rides.view';

const DETAIL_INCLUDE = {
  pickupZone: true,
  dropoffZone: true,
  pool: { include: { driver: true } },
} as const;

@Injectable()
export class RidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zones: ZonesService,
    private readonly events: EventsService,
  ) {}

  async create(passengerId: string, dto: CreateRideDto) {
    const rideId = await this.prisma.$transaction(async (tx) => {
      const { distanceM, quote } = await this.zones.trip(
        dto.pickupZoneId,
        dto.dropoffZoneId,
        dto.seats,
        tx,
      );
      // Partial unique index rr_one_active_per_passenger -> 409 ACTIVE_RIDE_EXISTS.
      const ride = await tx.rideRequest.create({
        data: {
          passengerId,
          pickupZoneId: dto.pickupZoneId,
          dropoffZoneId: dto.dropoffZoneId,
          seats: dto.seats,
          distanceM,
          paymentMethod: dto.paymentMethod,
          estimatedFarePaisa: quote.solo,
        },
      });
      await this.events.record(tx, {
        type: 'RIDE_REQUESTED',
        rideRequestId: ride.id,
        to: 'REQUESTED',
        actorUserId: passengerId,
        metadata: {
          seats: dto.seats,
          distanceM,
          estimatedFarePaisa: quote.solo,
        },
      });
      return ride.id;
    });
    return this.detail(passengerId, rideId);
  }

  async list(passengerId: string, page: PageQueryDto) {
    const where = { passengerId };
    const [items, total] = await Promise.all([
      this.prisma.rideRequest.findMany({
        where,
        include: { pickupZone: true, dropoffZone: true },
        orderBy: { createdAt: 'desc' },
        take: page.limit,
        skip: page.offset,
      }),
      this.prisma.rideRequest.count({ where }),
    ]);
    return { items: items.map(rideSummaryView), total };
  }

  async active(passengerId: string) {
    const ride = await this.prisma.rideRequest.findFirst({
      where: { passengerId, status: { in: ACTIVE_RIDE_STATUSES } },
      select: { id: true },
    });
    return ride ? this.detail(passengerId, ride.id) : null;
  }

  async detail(passengerId: string, rideId: string) {
    const ride = await this.prisma.rideRequest.findUnique({
      where: { id: rideId },
      include: DETAIL_INCLUDE,
    });
    if (!ride) throw new DomainError('NOT_FOUND', 'Ride not found');
    if (ride.passengerId !== passengerId)
      throw new DomainError('FORBIDDEN', 'This ride is not yours');

    const coPassengers = ride.poolId
      ? await this.prisma.rideRequest.count({
          where: { poolId: ride.poolId, id: { not: ride.id } },
        })
      : 0;
    // Own events, plus pool-level events (no ride id) of every pool this ride was ever in.
    // Other members' events are excluded: a passenger never learns about co-passengers.
    const poolIds = (
      await this.prisma.rideEvent.findMany({
        where: { rideRequestId: ride.id, poolId: { not: null } },
        select: { poolId: true },
        distinct: ['poolId'],
      })
    ).map((e) => e.poolId!);
    const events = await this.prisma.rideEvent.findMany({
      where: {
        OR: [
          { rideRequestId: ride.id },
          { poolId: { in: poolIds }, rideRequestId: null },
        ],
      },
      orderBy: { id: 'asc' },
    });
    return rideDetailView(ride, coPassengers, events);
  }

  async cancel(passengerId: string, rideId: string) {
    await this.prisma.$transaction(async (tx) => {
      const ride = await this.ownRide(tx, passengerId, rideId);
      if (ride.status !== 'REQUESTED')
        throw invalidTransition('Ride', ride.status, 'CANCELLED');
      const res = await tx.rideRequest.updateMany({
        where: { id: ride.id, status: 'REQUESTED' },
        data: { status: 'CANCELLED', cancelledBy: 'PASSENGER' },
      });
      if (res.count === 0)
        throw invalidTransition('Ride', ride.status, 'CANCELLED');
      await this.events.record(tx, {
        type: 'RIDE_CANCELLED',
        rideRequestId: ride.id,
        from: 'REQUESTED',
        to: 'CANCELLED',
        actorUserId: passengerId,
        metadata: { cancelledBy: 'PASSENGER' },
      });
    });
    return this.detail(passengerId, rideId);
  }

  // Ownership before any transition logic: a stranger never learns the state.
  private async ownRide(tx: Tx, passengerId: string, rideId: string) {
    const ride = await tx.rideRequest.findUnique({ where: { id: rideId } });
    if (!ride) throw new DomainError('NOT_FOUND', 'Ride not found');
    if (ride.passengerId !== passengerId)
      throw new DomainError('FORBIDDEN', 'This ride is not yours');
    return ride;
  }
}
