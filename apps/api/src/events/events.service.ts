import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Tx } from '../prisma/prisma.service';

// Driver availability is not a ride event: ev_has_subject requires a ride or a pool.
export type EventType =
  | 'RIDE_REQUESTED'
  | 'RIDE_MATCHED'
  | 'RIDE_UNMATCHED'
  | 'RIDE_CANCELLED'
  | 'POOL_CREATED'
  | 'POOL_DRIVER_ARRIVED'
  | 'POOL_STARTED'
  | 'POOL_COMPLETED'
  | 'POOL_CANCELLED'
  | 'FARE_LOCKED'
  | 'PAYMENT_SETTLED';

export interface EventInput {
  type: EventType;
  rideRequestId?: string;
  poolId?: string;
  from?: string | null;
  to?: string | null;
  actorUserId?: string | null; // null = system
  metadata?: Prisma.InputJsonObject;
}

// Append-only audit trail. Always written inside the caller's transaction so
// the history can never disagree with the state it describes.
@Injectable()
export class EventsService {
  record(tx: Tx, e: EventInput) {
    return tx.rideEvent.create({
      data: {
        eventType: e.type,
        rideRequestId: e.rideRequestId,
        poolId: e.poolId,
        fromStatus: e.from ?? null,
        toStatus: e.to ?? null,
        actorUserId: e.actorUserId ?? null,
        metadata: e.metadata ?? {},
      },
    });
  }
}
