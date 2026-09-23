export type RideStatus =
  'REQUESTED' | 'MATCHED' | 'DRIVER_ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PoolStatus = 'OPEN' | 'DRIVER_ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const LABELS: Record<RideStatus | PoolStatus, string> = {
  REQUESTED: 'Waiting',
  MATCHED: 'Matched',
  OPEN: 'Open',
  DRIVER_ARRIVED: 'Driver arrived',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const statusLabel = (s: RideStatus | PoolStatus) => LABELS[s];

export const isTerminal = (s?: RideStatus | PoolStatus | null) => s === 'COMPLETED' || s === 'CANCELLED';

// Mirrors the API's transition tables; the server still decides and a 409 is shown as-is.
export const PASSENGER_CAN_CANCEL: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'];

export type PoolAction = 'arrive' | 'start' | 'complete' | 'cancel';
export const POOL_ACTIONS: Record<PoolStatus, PoolAction[]> = {
  OPEN: ['arrive', 'cancel'],
  DRIVER_ARRIVED: ['start', 'cancel'],
  IN_PROGRESS: ['complete'],
  COMPLETED: [],
  CANCELLED: [],
};

export const RIDE_STEPS: RideStatus[] = [
  'REQUESTED',
  'MATCHED',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
];
