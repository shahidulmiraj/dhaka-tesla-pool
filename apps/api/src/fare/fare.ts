import {
  BASE_FARE_PAISA,
  EARTH_RADIUS_M,
  PER_KM_PAISA,
  POOL_DISCOUNT,
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

export interface Quote {
  /** per seat */
  baseFare: number;
  /** per seat */
  distanceCharge: number;
  /** per seat, applied only when pooled */
  poolDiscount: number;
  /** total for all seats, riding alone */
  solo: number;
  /** total for all seats, sharing with at least one other request */
  pooled: number;
}

// passengerFare = (baseFare + distanceCharge - poolDiscount) x seats
export function quote(distanceM: number, seats: number): Quote {
  const distanceCharge = Math.round((distanceM * PER_KM_PAISA) / 1000);
  const poolDiscount = Math.round(POOL_DISCOUNT * distanceCharge);
  const perSeatSolo = BASE_FARE_PAISA + distanceCharge;
  return {
    baseFare: BASE_FARE_PAISA,
    distanceCharge,
    poolDiscount,
    solo: perSeatSolo * seats,
    pooled: (perSeatSolo - poolDiscount) * seats,
  };
}

// Discount counts member requests, not seats.
export function finalFare(q: Quote, memberRequests: number): number {
  return memberRequests >= 2 ? q.pooled : q.solo;
}
