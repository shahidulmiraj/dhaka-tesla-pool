import { PoolStatus, RideStatus } from '@prisma/client';
import { DomainError } from '../common/errors';

// The state machines are data, not if-chains. See docs: two lifecycles.
export const RIDE_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  REQUESTED: ['MATCHED', 'DRIVER_ARRIVED', 'CANCELLED'],
  MATCHED: ['DRIVER_ARRIVED', 'CANCELLED', 'REQUESTED'],
  DRIVER_ARRIVED: ['IN_PROGRESS', 'CANCELLED', 'REQUESTED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const POOL_TRANSITIONS: Record<PoolStatus, PoolStatus[]> = {
  OPEN: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

// pool status -> status its members must have (CANCELLED: members revert to REQUESTED)
export const MEMBER_STATUS_FOR_POOL: Record<PoolStatus, RideStatus | null> = {
  OPEN: 'MATCHED',
  DRIVER_ARRIVED: 'DRIVER_ARRIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: null,
};

export const ACTIVE_RIDE_STATUSES: RideStatus[] = [
  'REQUESTED',
  'MATCHED',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
];
export const ACTIVE_POOL_STATUSES: PoolStatus[] = [
  'OPEN',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
];
export const JOINABLE_POOL_STATUSES: PoolStatus[] = ['OPEN', 'DRIVER_ARRIVED'];

export const canRideTransition = (from: RideStatus, to: RideStatus) =>
  RIDE_TRANSITIONS[from].includes(to);
export const canPoolTransition = (from: PoolStatus, to: PoolStatus) =>
  POOL_TRANSITIONS[from].includes(to);

export const invalidTransition = (
  what: 'Ride' | 'Pool',
  from: string,
  to: string,
) =>
  new DomainError(
    'INVALID_TRANSITION',
    `${what} cannot move from ${from} to ${to}`,
  );

// Statuses that can reach `to` in one step: the WHERE clause of a conditional update.
export const poolSourcesOf = (to: PoolStatus) =>
  (Object.keys(POOL_TRANSITIONS) as PoolStatus[]).filter((s) =>
    canPoolTransition(s, to),
  );
export const rideSourcesOf = (to: RideStatus) =>
  (Object.keys(RIDE_TRANSITIONS) as RideStatus[]).filter((s) =>
    canRideTransition(s, to),
  );
