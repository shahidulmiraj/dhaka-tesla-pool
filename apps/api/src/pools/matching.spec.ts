import { ZONES } from '../seed';
import { fits, isDestinationCompatible } from './matching';

const z = (name: string) => ZONES.find((x) => x.name === name)!;

describe('isDestinationCompatible (3 km from every member)', () => {
  it('Rafiq (Gulshan 1) can join Nusrat (Mohakhali): 1560 m', () => {
    expect(isDestinationCompatible(z('Gulshan 1'), [z('Mohakhali')])).toBe(
      true,
    );
  });
  it('Shirin (Gulshan 2) can join Nusrat and Rafiq: 2056 m and 1328 m', () => {
    expect(
      isDestinationCompatible(z('Gulshan 2'), [z('Mohakhali'), z('Gulshan 1')]),
    ).toBe(true);
  });
  it('Farmgate vs Mohakhali is borderline but compatible: 2562 m', () => {
    expect(isDestinationCompatible(z('Farmgate'), [z('Mohakhali')])).toBe(true);
  });
  it('Uttara vs Mohakhali is not: 11131 m', () => {
    expect(isDestinationCompatible(z('Uttara'), [z('Mohakhali')])).toBe(false);
  });
  it('must hold for every member, not just one', () => {
    expect(
      isDestinationCompatible(z('Farmgate'), [z('Mohakhali'), z('Gulshan 2')]),
    ).toBe(false);
  });
  it('an empty pool accepts anyone', () => {
    expect(isDestinationCompatible(z('Uttara'), [])).toBe(true);
  });
});

describe('fits', () => {
  it('1 seat fits in 2 of 3 taken, 2 seats do not', () => {
    expect(fits(2, 3, 1)).toBe(true);
    expect(fits(2, 3, 2)).toBe(false);
    expect(fits(3, 3, 1)).toBe(false);
  });
});
