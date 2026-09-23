import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { seed } from '../src/seed';
import { PrismaService } from '../src/prisma/prisma.service';
import { api, auth, createApp, resetDb } from './app';
import {
  accept,
  Actor,
  goOnline,
  poolAction,
  requestRide,
  signUp,
} from './cast';

describe('history explains what happened', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jashim: Actor, nusrat: Actor, rafiq: Actor;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    [jashim, nusrat, rafiq] = await Promise.all(
      (['jashim', 'nusrat', 'rafiq'] as const).map((n) => signUp(app, n)),
    );
  });

  it('after a full trip each passenger and the driver see one completed item with a full timeline', async () => {
    await goOnline(app, jashim).expect(200);
    const n = (await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201))
      .body.id;
    await requestRide(app, rafiq, { to: 'Gulshan 1' }).expect(201);
    const poolId = (await accept(app, jashim, n).expect(201)).body.id;
    for (const a of ['arrive', 'start', 'complete'] as const)
      await poolAction(app, jashim, poolId, a).expect(200);

    for (const p of [nusrat, rafiq]) {
      const list = await api(app)
        .get('/api/v1/rides')
        .set(auth(p.token))
        .expect(200);
      expect(list.body).toMatchObject({
        total: 1,
        items: [
          { status: 'COMPLETED', fareIsFinal: true, paymentStatus: 'PAID' },
        ],
      });
    }
    const pools = await api(app)
      .get('/api/v1/driver/pools')
      .set(auth(jashim.token))
      .expect(200);
    expect(pools.body).toMatchObject({
      total: 1,
      items: [
        { id: poolId, status: 'COMPLETED', memberCount: 2, seatsTaken: 2 },
      ],
    });

    const detail = await api(app)
      .get(`/api/v1/driver/pools/${poolId}`)
      .set(auth(jashim.token))
      .expect(200);
    expect(detail.body.events.map((e: { type: string }) => e.type)).toEqual([
      'POOL_CREATED',
      'RIDE_MATCHED',
      'RIDE_MATCHED',
      'POOL_DRIVER_ARRIVED',
      'POOL_STARTED',
      'FARE_LOCKED',
      'FARE_LOCKED',
      'POOL_COMPLETED',
      'PAYMENT_SETTLED',
      'PAYMENT_SETTLED',
    ]);
  });

  it('paginates history with limit and offset (max 50)', async () => {
    await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201);
    const page = await api(app)
      .get('/api/v1/rides')
      .query({ limit: 1, offset: 1 })
      .set(auth(nusrat.token))
      .expect(200);
    expect(page.body).toMatchObject({ total: 1, items: [] });
    await api(app)
      .get('/api/v1/rides')
      .query({ limit: 51 })
      .set(auth(nusrat.token))
      .expect(400);
  });
});

describe('seed', () => {
  it('is idempotent: running it twice gives the same row counts', async () => {
    const prisma = new PrismaClient();
    await prisma.$executeRawUnsafe(
      'TRUNCATE ride_events, ride_requests, pools, vehicles, users RESTART IDENTITY CASCADE',
    );
    const counts = () =>
      Promise.all([
        prisma.user.count(),
        prisma.vehicle.count(),
        prisma.zone.count(),
        prisma.pool.count(),
        prisma.rideRequest.count(),
        prisma.rideEvent.count(),
      ]);
    await seed(prisma);
    const first = await counts();
    await seed(prisma);
    expect(await counts()).toEqual(first);
    expect(first).toEqual([5, 2, 12, 1, 2, 12]);
    await prisma.$disconnect();
  });
});
