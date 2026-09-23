import { Injectable } from '@nestjs/common';
import { Zone } from '@prisma/client';
import { DomainError } from '../common/errors';
import { haversineM, quote } from '../fare/fare';
import { PrismaService, Tx } from '../prisma/prisma.service';

export const zoneView = (z: Zone) => ({
  id: z.id,
  name: z.name,
  lat: z.lat.toNumber(),
  lng: z.lng.toNumber(),
});

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.zone
      .findMany({ orderBy: { name: 'asc' } })
      .then((zs) => zs.map(zoneView));
  }

  // Validates a pickup/dropoff pair and prices it. Used by the estimate
  // endpoint and by ride creation so both quote the same number.
  async trip(
    pickupZoneId: number,
    dropoffZoneId: number,
    seats: number,
    tx: Tx = this.prisma,
  ) {
    if (pickupZoneId === dropoffZoneId) {
      throw new DomainError(
        'SAME_ZONE',
        'Pickup and destination must be different zones',
      );
    }
    const zones = await tx.zone.findMany({
      where: { id: { in: [pickupZoneId, dropoffZoneId] } },
    });
    const pickup = zones.find((z) => z.id === pickupZoneId);
    const dropoff = zones.find((z) => z.id === dropoffZoneId);
    if (!pickup || !dropoff) {
      throw new DomainError('VALIDATION_ERROR', 'Unknown zone', [
        {
          field: pickup ? 'dropoffZoneId' : 'pickupZoneId',
          problems: ['zone does not exist'],
        },
      ]);
    }
    const distanceM = haversineM(zoneView(pickup), zoneView(dropoff));
    return { pickup, dropoff, distanceM, quote: quote(distanceM, seats) };
  }
}
