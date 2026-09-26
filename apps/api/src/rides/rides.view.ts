import { Pool, RideEvent, RideRequest, User, Zone } from '@prisma/client';
import { pooledForMembers, quote } from '../fare/fare';

type RideRow = RideRequest & {
  pickupZone: Zone;
  dropoffZone: Zone;
  pool: (Pool & { driver: User }) | null;
};

export const eventView = (e: RideEvent) => ({
  type: e.eventType,
  from: e.fromStatus,
  to: e.toStatus,
  at: e.createdAt,
  metadata: e.metadata,
});

// Passenger view: own fare and status only. Co-passengers are a count.
export const rideDetailView = (
  r: RideRow,
  coPassengers: number,
  events: RideEvent[],
) => {
  // Before a driver accepts: show the 2-passenger (minimum pool) optimistic estimate.
  // After a driver accepts: show the fare based on the vehicle capacity
  // (i.e., "if this Tesla fills up"). This changes once the trip starts and
  // finalFarePaisa is locked.
  const pooledEstimatePaisa = r.pool
    ? pooledForMembers(r.distanceM, r.seats, r.pool.capacity)
    : pooledForMembers(r.distanceM, r.seats, 2);

  return {
    id: r.id,
    status: r.status,
    seats: r.seats,
    paymentMethod: r.paymentMethod,
    paymentStatus: r.paymentStatus,
    cancelledBy: r.cancelledBy,
    pickupZone: { id: r.pickupZone.id, name: r.pickupZone.name },
    dropoffZone: { id: r.dropoffZone.id, name: r.dropoffZone.name },
    distanceM: r.distanceM,
    estimatedFarePaisa: r.estimatedFarePaisa,
    pooledEstimatePaisa,
    finalFarePaisa: r.finalFarePaisa,
    pool: r.pool && {
      id: r.pool.id,
      status: r.pool.status,
      driverName: r.pool.driver.fullName,
      vehicleName: r.pool.vehicleName,
      capacity: r.pool.capacity,
      coPassengers,
    },
    events: events.map(eventView),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
};


export const rideSummaryView = (
  r: RideRequest & { pickupZone: Zone; dropoffZone: Zone },
) => ({
  id: r.id,
  status: r.status,
  seats: r.seats,
  pickupZone: { id: r.pickupZone.id, name: r.pickupZone.name },
  dropoffZone: { id: r.dropoffZone.id, name: r.dropoffZone.name },
  farePaisa: r.finalFarePaisa ?? r.estimatedFarePaisa,
  fareIsFinal: r.finalFarePaisa !== null,
  paymentMethod: r.paymentMethod,
  paymentStatus: r.paymentStatus,
  createdAt: r.createdAt,
});
