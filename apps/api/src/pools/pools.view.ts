import { Pool, RideEvent, RideRequest, User, Zone } from '@prisma/client';
import { finalFare } from '../fare/fare';
import { zoneView } from '../zones/zones.service';
import { endZone } from './matching';

type Member = RideRequest & { passenger: User; dropoffZone: Zone };

// Drivers collect cash, so they see each member's fare and payment status,
// but never wallet balances or emails.
const HIDDEN_FROM_DRIVER = ['walletBefore', 'walletAfter'];

const zoneRef = (z: { id: number; name: string } | null) =>
  z && { id: z.id, name: z.name };

export const poolDetailView = (
  p: Pool & { pickupZone: Zone; members: Member[] },
  events: RideEvent[],
) => ({
  id: p.id,
  status: p.status,
  vehicleName: p.vehicleName,
  capacity: p.capacity,
  seatsTaken: p.seatsTaken,
  pickupZone: { id: p.pickupZone.id, name: p.pickupZone.name },
  members: p.members.map((m) => ({
    rideId: m.id,
    passengerName: m.passenger.fullName,
    seats: m.seats,
    dropoffZone: m.dropoffZone.name,
    status: m.status,
    // Before start: the fare they would pay if the pool started now.
    farePaisa:
      m.finalFarePaisa ?? finalFare(m.distanceM, m.seats, p.members.length),
    fareIsFinal: m.finalFarePaisa !== null,
    paymentMethod: m.paymentMethod,
    paymentStatus: m.paymentStatus,
  })),
  events: events.map((e) => ({
    type: e.eventType,
    rideId: e.rideRequestId,
    from: e.fromStatus,
    to: e.toStatus,
    at: e.createdAt,
    metadata: Object.fromEntries(
      Object.entries((e.metadata ?? {}) as Record<string, unknown>).filter(
        ([k]) => !HIDDEN_FROM_DRIVER.includes(k),
      ),
    ),
  })),
  // Where Bullet finishes; the driver's app switches its serving zone here on completion.
  endZone: zoneRef(
    endZone(
      zoneView(p.pickupZone),
      p.members.map((m) => zoneView(m.dropoffZone)),
    ),
  ),
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export const poolSummaryView = (
  p: Pool & { pickupZone: Zone; _count: { members: number } },
) => ({
  id: p.id,
  status: p.status,
  vehicleName: p.vehicleName,
  capacity: p.capacity,
  seatsTaken: p.seatsTaken,
  memberCount: p._count.members,
  pickupZone: { id: p.pickupZone.id, name: p.pickupZone.name },
  createdAt: p.createdAt,
});
