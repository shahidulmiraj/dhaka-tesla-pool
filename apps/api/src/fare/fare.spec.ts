import { ZONES } from '../seed';
import { finalFare, haversineM, quote } from './fare';

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

describe('quote', () => {
  it('Nusrat: 1824 x 1500 / 1000 = 2736; 3000 + 2736 = 5736; 0.2 x 2736 = 547.2 -> 547; 5736 - 547 = 5189', () => {
    expect(quote(1824, 1)).toEqual({
      baseFare: 3000,
      distanceCharge: 2736,
      poolDiscount: 547,
      solo: 5736,
      pooled: 5189,
    });
  });

  it('Rafiq: 1770 m -> 5655 solo, 5124 pooled', () => {
    expect(quote(1770, 1)).toMatchObject({
      distanceCharge: 2655,
      solo: 5655,
      pooled: 5124,
    });
  });

  it('Shirin: 785 m -> 4178 solo, 3942 pooled', () => {
    expect(quote(785, 1)).toMatchObject({
      distanceCharge: 1178,
      solo: 4178,
      pooled: 3942,
    });
  });

  it('multiplies by seats', () => {
    expect(quote(1824, 2).solo).toBe(11472);
    expect(quote(1824, 2).pooled).toBe(10378);
  });

  it('rounds half up with Math.round on integers only', () => {
    expect(quote(1, 1).distanceCharge).toBe(2); // 1.5 -> 2
    expect(quote(3, 1).distanceCharge).toBe(5); // 4.5 -> 5
    expect(quote(1770, 1).poolDiscount).toBe(531); // 531.0
  });
});

describe('finalFare', () => {
  it('is the solo fare when riding alone', () => {
    expect(finalFare(quote(1824, 1), 1)).toBe(5736);
  });
  it('is the pooled fare when two or more requests share', () => {
    expect(finalFare(quote(1824, 1), 2)).toBe(5189);
    expect(finalFare(quote(1824, 1), 3)).toBe(5189);
  });
});
