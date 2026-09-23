import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../common/errors';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_POOL_STATUSES } from './transitions';

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
