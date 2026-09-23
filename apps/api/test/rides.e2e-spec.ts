import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { api, auth, createApp, resetDb } from './app';
import { Actor, requestRide, signUp } from './cast';

describe('passenger ride requests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let nusrat: Actor, rafiq: Actor;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    [nusrat, rafiq] = await Promise.all([
      signUp(app, 'nusrat'),
      signUp(app, 'rafiq'),
    ]);
  });

  it('creates Nusrat\'s request with distance and "up to" fare, waiting for a driver', async () => {
    const res = await requestRide(app, nusrat, {
      to: 'Mohakhali',
      paymentMethod: 'TESLAPAY',
    }).expect(201);
    expect(res.body).toMatchObject({
      status: 'REQUESTED',
      seats: 1,
      paymentMethod: 'TESLAPAY',
      paymentStatus: null,
      pickupZone: { name: 'Banani' },
      dropoffZone: { name: 'Mohakhali' },
      distanceM: 1824,
      estimatedFarePaisa: 5736,
      pooledEstimatePaisa: 5189,
      finalFarePaisa: null,
      pool: null,
    });
    expect(res.body.events.map((e: { type: string }) => e.type)).toEqual([
      'RIDE_REQUESTED',
    ]);

    const rafiqRes = await requestRide(app, rafiq, { to: 'Gulshan 1' }).expect(
      201,
    );
    expect(rafiqRes.body.estimatedFarePaisa).toBe(5655);
  });

  it('shows the active ride, then 204 once cancelled, and lists history newest first', async () => {
    const first = await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(
      201,
    );
    const active = await api(app)
      .get('/api/v1/rides/active')
      .set(auth(nusrat.token))
      .expect(200);
    expect(active.body.id).toBe(first.body.id);

    await api(app)
      .post(`/api/v1/rides/${first.body.id}/cancel`)
      .set(auth(nusrat.token))
      .expect(200);
    await api(app)
      .get('/api/v1/rides/active')
      .set(auth(nusrat.token))
      .expect(204);

    const second = await requestRide(app, nusrat, { to: 'Gulshan 2' }).expect(
      201,
    );
    const list = await api(app)
      .get('/api/v1/rides')
      .set(auth(nusrat.token))
      .expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.items.map((r: { id: string }) => r.id)).toEqual([
      second.body.id,
      first.body.id,
    ]);
    expect(list.body.items[1]).toMatchObject({
      status: 'CANCELLED',
      farePaisa: 5736,
      fareIsFinal: false,
    });
  });

  it('cancels from REQUESTED with cancelledBy PASSENGER and records the event', async () => {
    const ride = await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(
      201,
    );
    const res = await api(app)
      .post(`/api/v1/rides/${ride.body.id}/cancel`)
      .set(auth(nusrat.token))
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'CANCELLED',
      cancelledBy: 'PASSENGER',
      pool: null,
    });
    expect(res.body.events.map((e: { type: string }) => e.type)).toEqual([
      'RIDE_REQUESTED',
      'RIDE_CANCELLED',
    ]);

    const again = await api(app)
      .post(`/api/v1/rides/${ride.body.id}/cancel`)
      .set(auth(nusrat.token))
      .expect(409);
    expect(again.body).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'Ride cannot move from CANCELLED to CANCELLED',
    });
  });

  it('rejects a second active request with ACTIVE_RIDE_EXISTS (partial unique index)', async () => {
    await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201);
    const res = await requestRide(app, nusrat, { to: 'Gulshan 1' }).expect(409);
    expect(res.body.code).toBe('ACTIVE_RIDE_EXISTS');
  });

  it('turns a double-submit into exactly one request', async () => {
    const results = await Promise.all([
      requestRide(app, nusrat, { to: 'Mohakhali' }),
      requestRide(app, nusrat, { to: 'Mohakhali' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.rideRequest.count({
        where: { passengerId: nusrat.user.id },
      }),
    ).toBe(1);
  });

  it('rejects pickup = destination with SAME_ZONE and too many seats with VALIDATION_ERROR', async () => {
    const same = await requestRide(app, nusrat, {
      from: 'Banani',
      to: 'Banani',
    }).expect(400);
    expect(same.body.code).toBe('SAME_ZONE');
    const seats = await requestRide(app, nusrat, {
      to: 'Mohakhali',
      seats: 7,
    }).expect(400);
    expect(seats.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an unknown ride id and 400 for a malformed one', async () => {
    const res = await api(app)
      .get('/api/v1/rides/6f1c1d2e-0000-4000-8000-000000000000')
      .set(auth(nusrat.token))
      .expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
    await api(app)
      .get('/api/v1/rides/not-a-uuid')
      .set(auth(nusrat.token))
      .expect(400);
  });
});
