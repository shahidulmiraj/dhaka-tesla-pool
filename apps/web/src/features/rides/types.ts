import type { PoolStatus, RideStatus } from '@/lib/status';

// Mirrors the API's passenger view (see Swagger at /docs).
export type PaymentMethod = 'CASH' | 'TESLAPAY';
export type PaymentStatus = 'PAID' | 'PENDING';

export interface Zone {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface FareEstimate {
  distanceM: number;
  seats: number;
  soloFarePaisa: number;
  /** 3 pooled requests = 30 % off the distance charge */
  pooled3FarePaisa: number;
  /** 5+ requests = 50 % off (maximum discount) */
  pooledMaxFarePaisa: number;
  breakdown: {
    baseFarePaisa: number;
    distanceChargePaisa: number;
    poolDiscount3Paisa: number;
    poolDiscountMaxPaisa: number;
  };
}

export interface RideEvent {
  type: string;
  from: string | null;
  to: string | null;
  at: string;
  metadata: Record<string, unknown>;
}

export interface RideDetail {
  id: string;
  status: RideStatus;
  seats: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus | null;
  cancelledBy: 'PASSENGER' | 'DRIVER' | 'SYSTEM' | null;
  pickupZone: { id: number; name: string };
  dropoffZone: { id: number; name: string };
  distanceM: number;
  estimatedFarePaisa: number;
  pooledEstimatePaisa: number;
  finalFarePaisa: number | null;
  pool: {
    id: string;
    status: PoolStatus;
    driverName: string;
    vehicleName: string;
    capacity: number;
    coPassengers: number;
  } | null;
  events: RideEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface RideSummary {
  id: string;
  status: RideStatus;
  seats: number;
  pickupZone: { id: number; name: string };
  dropoffZone: { id: number; name: string };
  farePaisa: number;
  fareIsFinal: boolean;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus | null;
  createdAt: string;
}

export interface CreateRideInput {
  pickupZoneId: number;
  dropoffZoneId: number;
  seats: number;
  paymentMethod: PaymentMethod;
}
