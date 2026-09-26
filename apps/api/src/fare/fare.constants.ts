// All money is integer paisa (1 BDT = 100 paisa). Printed in the README.
export const BASE_FARE_PAISA = 3000; // 30 BDT
export const PER_KM_PAISA = 1500; // 15 BDT/km
export const EARTH_RADIUS_M = 6_371_000;

// Discount applied to the distance charge, keyed by number of pooled requests.
// 2 passengers = 20 %, 3 = 30 %, 4 = 40 %, 5+ = 50 % (hard cap).
export const POOL_DISCOUNT_BY_MEMBERS: Record<number, number> = {
  2: 0.2,
  3: 0.3,
  4: 0.4,
  5: 0.5,
};
export const MAX_POOL_DISCOUNT = 0.5;

