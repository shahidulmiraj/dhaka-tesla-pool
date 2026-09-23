import type { PaymentMethod, PaymentStatus } from '@/features/rides/types';
import type { PoolStatus, RideStatus } from '@/lib/status';

// Mirrors the API's driver view (see Swagger at /docs).
export interface OpenRequest {
  id: string;
  passengerFirstName: string;
  pickupZone: { id: number; name: string };
  dropoffZone: { id: number; name: string };
  seats: number;
  createdAt: string;
}

export interface PoolMember {
  rideId: string;
  passengerName: string;
  seats: number;
  dropoffZone: string;
  status: RideStatus;
  farePaisa: number;
  fareIsFinal: boolean;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus | null;
}

export interface PoolDetail {
  id: string;
  status: PoolStatus;
  vehicleName: string;
  capacity: number;
  seatsTaken: number;
  pickupZone: { id: number; name: string };
  members: PoolMember[];
  events: { type: string; rideId: string | null; at: string; metadata: Record<string, unknown> }[];
  createdAt: string;
  updatedAt: string;
}

export interface PoolSummary {
  id: string;
  status: PoolStatus;
  vehicleName: string;
  capacity: number;
  seatsTaken: number;
  memberCount: number;
  pickupZone: { id: number; name: string };
  createdAt: string;
}
