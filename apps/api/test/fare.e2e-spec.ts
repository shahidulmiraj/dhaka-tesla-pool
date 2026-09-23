import { INestApplication } from '@nestjs/common';
import { api, createApp, zoneId } from './app';

describe('fare estimate (public)', () => {
  let app: INestApplication;
  let banani: number, mohakhali: number, gulshan1: number;

  beforeAll(async () => {
    ({ app } = await createApp());
    [banani, mohakhali, gulshan1] = ['Banani', 'Mohakhali', 'Gulshan 1'].map(
      zoneId,
    );
  });
  afterAll(() => app.close());

  it('lists the twelve Dhaka zones with coordinates', async () => {
    const res = await api(app).get('/api/v1/zones').expect(200);
    expect(res.body).toHaveLength(12);
    expect(res.body).toContainEqual({
      id: banani,
      name: 'Banani',
      lat: 23.7937,
      lng: 90.4066,
    });
  });

  it("quotes Nusrat's Banani -> Mohakhali at 57.36 solo, 51.89 pooled", async () => {
    const res = await api(app)
      .get('/api/v1/fare/estimate')
      .query({ pickupZoneId: banani, dropoffZoneId: mohakhali, seats: 1 })
      .expect(200);
    expect(res.body).toEqual({
      distanceM: 1824,
      seats: 1,
      soloFarePaisa: 5736,
      pooledFarePaisa: 5189,
      breakdown: {
        baseFarePaisa: 3000,
        distanceChargePaisa: 2736,
        poolDiscountPaisa: 547,
      },
    });
  });

  it("quotes Rafiq's Banani -> Gulshan 1 at 56.55 solo, 51.24 pooled", async () => {
    const res = await api(app)
      .get('/api/v1/fare/estimate')
      .query({ pickupZoneId: banani, dropoffZoneId: gulshan1, seats: 1 })
      .expect(200);
    expect(res.body).toMatchObject({
      distanceM: 1770,
      soloFarePaisa: 5655,
      pooledFarePaisa: 5124,
    });
  });

  it('rejects pickup = dropoff with SAME_ZONE and unknown zones with VALIDATION_ERROR', async () => {
    const same = await api(app)
      .get('/api/v1/fare/estimate')
      .query({ pickupZoneId: banani, dropoffZoneId: banani, seats: 1 })
      .expect(400);
    expect(same.body.code).toBe('SAME_ZONE');
    const unknown = await api(app)
      .get('/api/v1/fare/estimate')
      .query({ pickupZoneId: banani, dropoffZoneId: 9999, seats: 1 })
      .expect(400);
    expect(unknown.body.code).toBe('VALIDATION_ERROR');
    await api(app)
      .get('/api/v1/fare/estimate')
      .query({ pickupZoneId: banani, dropoffZoneId: mohakhali, seats: 7 })
      .expect(400);
  });
});
