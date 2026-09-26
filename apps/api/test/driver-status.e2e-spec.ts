import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { api, auth, createApp, resetDb, zoneId } from './app';
import { accept, Actor, goOnline, requestRide, signUp } from './cast';

describe('driver availability and open requests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jashim: Actor, nusrat: Actor, rafiq: Actor, shirin: Actor;
  const openIn = (zone: string) =>
    api(app)
      .get('/api/v1/driver/requests')
      .query({ pickupZoneId: zoneId(zone) })
      .set(auth(jashim.token));

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    [jashim, nusrat, rafiq, shirin] = await Promise.all(
      (['jashim', 'nusrat', 'rafiq', 'shirin'] as const).map((n) =>
        signUp(app, n),
      ),
    );
  });

  it('an offline driver cannot list or accept requests', async () => {
    const ride = (
      await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201)
    ).body.id;
    expect((await openIn('Banani').expect(409)).body.code).toBe(
      'DRIVER_OFFLINE',
    );
    expect((await accept(app, jashim, ride).expect(409)).body.code).toBe(
      'DRIVER_OFFLINE',
    );
  });

  it('lists only REQUESTED rides in the chosen zone, oldest first, first names only', async () => {
    await goOnline(app, jashim).expect(200);
    await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201);
    await requestRide(app, rafiq, { to: 'Gulshan 1' }).expect(201);
    await requestRide(app, shirin, { from: 'Gulshan 2', to: 'Banani' }).expect(
      201,
    );

    const res = await openIn('Banani').expect(200);
    expect(
      res.body.map((r: { passengerFirstName: string }) => r.passengerFirstName),
    ).toEqual(['Nusrat', 'Rafiq']);
    expect(res.body[0]).toEqual({
      id: expect.any(String),
      passengerFirstName: 'Nusrat',
      pickupZone: { id: zoneId('Banani'), name: 'Banani' },
      dropoffZone: { id: zoneId('Mohakhali'), name: 'Mohakhali' },
      seats: 1,
      createdAt: expect.any(String),
    });
  });

  it('cannot go offline with an active pool, and cannot accept a second pool', async () => {
    await goOnline(app, jashim).expect(200);
    const n = (await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201))
      .body.id;
    const far = (await requestRide(app, rafiq, { to: 'Uttara' }).expect(201))
      .body.id;
    await accept(app, jashim, n).expect(201);
    expect((await goOnline(app, jashim, false).expect(409)).body.code).toBe(
      'ACTIVE_POOL_EXISTS',
    );
    expect((await accept(app, jashim, far).expect(409)).body.code).toBe(
      'DRIVER_HAS_ACTIVE_POOL',
    );
    const active = await api(app)
      .get('/api/v1/driver/pools/active')
      .set(auth(jashim.token))
      .expect(200);
    expect(active.body.members).toHaveLength(1);
  });

  it('double-clicked accept on two requests creates one pool (partial unique index)', async () => {
    await goOnline(app, jashim).expect(200);
    const n = (await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201))
      .body.id;
    const far = (await requestRide(app, rafiq, { to: 'Uttara' }).expect(201))
      .body.id;
    const results = await Promise.all([
      accept(app, jashim, n),
      accept(app, jashim, far),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.code).toBe(
      'DRIVER_HAS_ACTIVE_POOL',
    );
    expect(await prisma.pool.count()).toBe(1);
  });

  it('goes offline again once no pool is active; 204 for no active pool', async () => {
    await goOnline(app, jashim).expect(200);
    expect((await goOnline(app, jashim, false).expect(200)).body).toEqual({
      isOnline: false,
    });
    await api(app)
      .get('/api/v1/driver/pools/active')
      .set(auth(jashim.token))
      .expect(204);
  });

  it('sets the serving zone and returns it from /auth/me; unknown zones are rejected', async () => {
    const res = await api(app)
      .patch('/api/v1/driver/zone')
      .set(auth(jashim.token))
      .send({ pickupZoneId: zoneId('Gulshan 2') })
      .expect(200);
    expect(res.body).toEqual({
      servingZone: { id: zoneId('Gulshan 2'), name: 'Gulshan 2' },
    });
    const me = await api(app)
      .get('/api/v1/auth/me')
      .set(auth(jashim.token))
      .expect(200);
    expect(me.body.servingZone.name).toBe('Gulshan 2');
    await api(app)
      .patch('/api/v1/driver/zone')
      .set(auth(jashim.token))
      .send({ pickupZoneId: 9999 })
      .expect(400);
    await api(app)
      .patch('/api/v1/driver/zone')
      .set(auth(nusrat.token))
      .send({ pickupZoneId: zoneId('Banani') })
      .expect(403);
  });
});
