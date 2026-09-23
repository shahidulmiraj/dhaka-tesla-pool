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
