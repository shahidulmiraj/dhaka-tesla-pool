import { haversineM, Point } from '../fare/fare';

// Rule 4: a new dropoff must be within this distance of EVERY member's dropoff.
export const MAX_DROPOFF_SPREAD_M = 3000;

export function isDestinationCompatible(
  dropoff: Point,
  memberDropoffs: Point[],
  maxM = MAX_DROPOFF_SPREAD_M,
): boolean {
  return memberDropoffs.every((m) => haversineM(dropoff, m) <= maxM);
}

// Rule 3: seats_taken + seats <= capacity.
export const fits = (seatsTaken: number, capacity: number, seats: number) =>
  seatsTaken + seats <= capacity;

// Where the vehicle ends up: with no per-passenger drop-off order in the MVP,
// the last stop is taken to be the drop-off farthest from the pickup.
export function endZone<Z extends Point>(
  pickup: Point,
  dropoffs: Z[],
): Z | null {
  let best: Z | null = null;
  let bestM = -1;
  for (const d of dropoffs) {
    const m = haversineM(pickup, d);
    if (m > bestM) [best, bestM] = [d, m];
  }
  return best;
}
