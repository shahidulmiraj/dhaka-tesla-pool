import {
  BASE_FARE_PAISA,
  EARTH_RADIUS_M,
  MAX_POOL_DISCOUNT,
  PER_KM_PAISA,
  POOL_DISCOUNT_BY_MEMBERS,
} from './fare.constants';

export interface Point {
  lat: number;
  lng: number;
}

// Great-circle distance, rounded to whole metres. The only float step.
export function haversineM(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/**
 * Tiered pool discount rate for a given number of pooled requests.
 * 1  → 0 % (solo, no discount)
 * 2  → 20 %
 * 3  → 30 %
 * 4  → 40 %
 * 5+ → 50 % (hard cap)
 */
export function poolDiscountRate(memberRequests: number): number {
  if (memberRequests <= 1) return 0;
  return POOL_DISCOUNT_BY_MEMBERS[memberRequests] ?? MAX_POOL_DISCOUNT;
}

export interface Quote {
  /** Per seat */
  baseFare: number;
  /** Per seat */
  distanceCharge: number;
  /** Total for all seats, riding alone */
  solo: number;
  /**
   * Pooled fare totals for common showcase tiers.
   * pooled2 = 2 requests (20 % off distance charge)
   * pooled3 = 3 requests (30 % off)
   * pooledMax = capacity requests at max 50 % off — filled in by the
   *   caller when the vehicle capacity is known.
   */
  pooled2: number;
  pooled3: number;
  pooledMax: number; // same formula: 50% discount, for display as "if full pool"
}

/** Compute fare for all seats at a given discount rate (0–1). */
function fareAtRate(
  baseFare: number,
  distanceCharge: number,
  seats: number,
  rate: number,
): number {
  const discount = Math.round(rate * distanceCharge);
  return (baseFare + distanceCharge - discount) * seats;
}

// passengerFare = (baseFare + distanceCharge − discount) × seats
export function quote(distanceM: number, seats: number): Quote {
  const distanceCharge = Math.round((distanceM * PER_KM_PAISA) / 1000);
  const perSeatSolo = BASE_FARE_PAISA + distanceCharge;
  return {
    baseFare: BASE_FARE_PAISA,
    distanceCharge,
    solo: perSeatSolo * seats,
    pooled2: fareAtRate(BASE_FARE_PAISA, distanceCharge, seats, 0.2),
    pooled3: fareAtRate(BASE_FARE_PAISA, distanceCharge, seats, 0.3),
    pooledMax: fareAtRate(
      BASE_FARE_PAISA,
      distanceCharge,
      seats,
      MAX_POOL_DISCOUNT,
    ),
  };
}

/**
 * Pooled fare for a specific member-request count.
 * Used when the vehicle capacity or actual pool size is known.
 * memberRequests = 1 → solo fare (no discount).
 */
export function pooledForMembers(
  distanceM: number,
  seats: number,
  memberRequests: number,
): number {
  const distanceCharge = Math.round((distanceM * PER_KM_PAISA) / 1000);
  return fareAtRate(
    BASE_FARE_PAISA,
    distanceCharge,
    seats,
    poolDiscountRate(memberRequests),
  );
}

/**
 * The fare locked at trip start. memberRequests is the actual number of
 * ride-request rows sharing this pool (not the number of seats).
 * Discount counts member requests, not seats.
 */
export function finalFare(
  distanceM: number,
  seats: number,
  memberRequests: number,
): number {
  return pooledForMembers(distanceM, seats, memberRequests);
}
