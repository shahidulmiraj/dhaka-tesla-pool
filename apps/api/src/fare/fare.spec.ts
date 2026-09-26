import { ZONES } from '../seed';
import { finalFare, haversineM, poolDiscountRate, quote } from './fare';

const z = (name: string) => ZONES.find((x) => x.name === name)!;

describe('haversineM on the seeded zones', () => {
  it.each([
    ['Banani', 'Mohakhali', 1824],
    ['Banani', 'Gulshan 1', 1770],
    ['Banani', 'Gulshan 2', 785],
    ['Mohakhali', 'Gulshan 1', 1560],
    ['Banani', 'Uttara', 9547],
  ])('%s -> %s is %i m', (a, b, m) => {
    expect(haversineM(z(a), z(b))).toBe(m);
  });
});

describe('poolDiscountRate', () => {
  it.each([
    [1, 0],
    [2, 0.2],
    [3, 0.3],
    [4, 0.4],
    [5, 0.5],
    [6, 0.5], // cap
    [10, 0.5], // cap
  ])('%i members → %f rate', (members, rate) => {
    expect(poolDiscountRate(members)).toBe(rate);
  });
});

describe('quote', () => {
  // Banani-Mohakhali: distanceCharge = round(1824*1500/1000) = 2736
  // solo = 3000 + 2736 = 5736
  // pooled2 (20%): discount = round(0.2*2736)=547; fare = 5736-547 = 5189
  // pooled3 (30%): discount = round(0.3*2736)=821; fare = 5736-821 = 4915
  // pooledMax(50%):discount = round(0.5*2736)=1368; fare = 5736-1368= 4368
  it('Nusrat: 1824 m solo=5736, pooled2=5189, pooled3=4915, pooledMax=4368', () => {
    expect(quote(1824, 1)).toMatchObject({
      baseFare: 3000,
      distanceCharge: 2736,
      solo: 5736,
      pooled2: 5189,
      pooled3: 4915,
      pooledMax: 4368,
    });
  });

  it('multiplies by seats (solo only)', () => {
    expect(quote(1824, 2).solo).toBe(11472);
    expect(quote(1824, 2).pooled2).toBe(10378);
  });
});

describe('finalFare (tiered by member request count)', () => {
  it('1 member  → solo (no discount)', () =>
    expect(finalFare(1824, 1, 1)).toBe(5736));
  it('2 members → 20% off distance charge', () =>
    expect(finalFare(1824, 1, 2)).toBe(5189));
  it('3 members → 30% off', () => expect(finalFare(1824, 1, 3)).toBe(4915));
  it('4 members → 40% off', () => expect(finalFare(1824, 1, 4)).toBe(4642));
  it('5 members → 50% off (cap)', () =>
    expect(finalFare(1824, 1, 5)).toBe(4368));
  it('6 members → still 50% off (cap)', () =>
    expect(finalFare(1824, 1, 6)).toBe(4368));
});
