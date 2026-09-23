import { PoolStatus, RideStatus } from '@prisma/client';
import {
  canPoolTransition,
  canRideTransition,
  MEMBER_STATUS_FOR_POOL,
  POOL_TRANSITIONS,
  poolSourcesOf,
  RIDE_TRANSITIONS,
} from './transitions';

const rides = Object.values(RideStatus);
const pools = Object.values(PoolStatus);

// Exhaustive by construction: every (from, to) pair, not hand-picked cases.
const ALLOWED_RIDE = new Set([
  'REQUESTED>MATCHED',
  'REQUESTED>DRIVER_ARRIVED',
  'REQUESTED>CANCELLED',
  'MATCHED>DRIVER_ARRIVED',
  'MATCHED>CANCELLED',
  'MATCHED>REQUESTED',
  'DRIVER_ARRIVED>IN_PROGRESS',
  'DRIVER_ARRIVED>CANCELLED',
  'DRIVER_ARRIVED>REQUESTED',
  'IN_PROGRESS>COMPLETED',
]);
const ALLOWED_POOL = new Set([
  'OPEN>DRIVER_ARRIVED',
  'OPEN>CANCELLED',
  'DRIVER_ARRIVED>IN_PROGRESS',
  'DRIVER_ARRIVED>CANCELLED',
  'IN_PROGRESS>COMPLETED',
]);

describe('ride transitions', () => {
  for (const from of rides)
    for (const to of rides)
      it(`${from} -> ${to} is ${ALLOWED_RIDE.has(`${from}>${to}`) ? 'allowed' : 'rejected'}`, () => {
        expect(canRideTransition(from, to)).toBe(
          ALLOWED_RIDE.has(`${from}>${to}`),
        );
      });

  it('has an entry for every status', () => {
    expect(Object.keys(RIDE_TRANSITIONS).sort()).toEqual([...rides].sort());
  });
});

describe('pool transitions', () => {
  for (const from of pools)
    for (const to of pools)
      it(`${from} -> ${to} is ${ALLOWED_POOL.has(`${from}>${to}`) ? 'allowed' : 'rejected'}`, () => {
        expect(canPoolTransition(from, to)).toBe(
          ALLOWED_POOL.has(`${from}>${to}`),
        );
      });

  it('has an entry for every status', () => {
    expect(Object.keys(POOL_TRANSITIONS).sort()).toEqual([...pools].sort());
  });

  it('derives conditional-update sources from the table', () => {
    expect(poolSourcesOf('IN_PROGRESS')).toEqual(['DRIVER_ARRIVED']);
    expect(poolSourcesOf('CANCELLED')).toEqual(['OPEN', 'DRIVER_ARRIVED']);
  });
});

describe('MEMBER_STATUS_FOR_POOL', () => {
  it('covers every pool status and every member status is reachable', () => {
    expect(Object.keys(MEMBER_STATUS_FOR_POOL).sort()).toEqual(
      [...pools].sort(),
    );
    expect(MEMBER_STATUS_FOR_POOL.CANCELLED).toBeNull();
    for (const p of pools) {
      const m = MEMBER_STATUS_FOR_POOL[p];
      if (m) expect(rides).toContain(m);
    }
  });
});
