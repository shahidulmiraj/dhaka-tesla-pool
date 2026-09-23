import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, resetDb } from './app';
import { accept, Actor, goOnline, requestRide, signUp } from './cast';

// Two (or five) passengers see one free seat at the same instant. Real Postgres,
// real HTTP, fired together with Promise.all. We assert on the database, not on 409s:
// losers are not errors, they simply stay REQUESTED.
describe('concurrent requests cannot corrupt pool capacity', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jashim: Actor, nusrat: Actor, rafiq: Actor;
  const RACERS = ['shirin', 'tania', 'farhan', 'mim', 'sabbir'] as const;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    [jashim, nusrat, rafiq] = await Promise.all(
      (['jashim', 'nusrat', 'rafiq'] as const).map((n) => signUp(app, n)),
    );
    await goOnline(app, jashim).expect(200);
  });

  it('Bullet has 1 seat left: five racers, exactly one joins', async () => {
    const n = (await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201))
      .body.id;
    await requestRide(app, rafiq, { to: 'Gulshan 1' }).expect(201);
    const pool = (await accept(app, jashim, n).expect(201)).body;
    expect(pool.seatsTaken).toBe(2);

    const racers = await Promise.all(RACERS.map((r) => signUp(app, r)));
    const results = await Promise.all(
      racers.map((r) => requestRide(app, r, { to: 'Gulshan 2' })),
    );

    results.forEach((res) => expect(res.status).toBe(201));
    expect(results.filter((r) => r.body.pool?.id === pool.id)).toHaveLength(1);
    const dbPool = await prisma.pool.findUniqueOrThrow({
      where: { id: pool.id },
    });
    expect(dbPool.seatsTaken).toBe(3);
    expect(await prisma.rideRequest.count({ where: { poolId: pool.id } })).toBe(
      3,
    );
    expect(
      await prisma.rideRequest.count({
        where: { status: 'REQUESTED', poolId: null },
      }),
    ).toBe(4);
  });

  it('Bullet has 2 seats left: five racers, exactly two join and three wait', async () => {
    const n = (await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201))
      .body.id;
    const pool = (await accept(app, jashim, n).expect(201)).body;
    expect(pool.seatsTaken).toBe(1);
    const racers = await Promise.all(RACERS.map((r) => signUp(app, r)));
    const results = await Promise.all(
      racers.map((r) => requestRide(app, r, { to: 'Gulshan 1' })),
    );
    results.forEach((res) => expect(res.status).toBe(201));
    expect(results.filter((r) => r.body.pool?.id === pool.id)).toHaveLength(2);
    expect(
      (await prisma.pool.findUniqueOrThrow({ where: { id: pool.id } }))
        .seatsTaken,
    ).toBe(3);
    expect(
      await prisma.rideRequest.count({ where: { status: 'REQUESTED' } }),
    ).toBe(3);
  });

  it('two drivers accept and sweep the same zone at once: every request in exactly one pool', async () => {
    const kamal = await signUp(app, 'kamal');
    await goOnline(app, kamal).expect(200);
    const racers = await Promise.all(RACERS.map((r) => signUp(app, r)));
    const rides = [];
    for (const [who, to] of [
      [nusrat, 'Mohakhali'],
      [rafiq, 'Gulshan 1'],
      ...racers.map((r) => [r, 'Gulshan 2'] as const),
    ] as const) {
      rides.push(
        (await requestRide(app, who, { to }).expect(201)).body.id as string,
      );
    }
    // Jashim takes the oldest, Kamal the newest; both sweep the other five.
    const [a, b] = await Promise.all([
      accept(app, jashim, rides[0]),
      accept(app, kamal, rides[6]),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);

    const pools = await prisma.pool.findMany({ include: { members: true } });
    for (const p of pools) {
      expect(p.seatsTaken).toBe(p.members.reduce((sum, m) => sum + m.seats, 0));
      expect(p.seatsTaken).toBeLessThanOrEqual(p.capacity);
    }
    expect(pools.map((p) => p.seatsTaken).sort()).toEqual([2, 3]); // Rocket and Bullet both full
    const all = await prisma.rideRequest.findMany();
    expect(all.filter((r) => r.poolId).length).toBe(5);
    expect(new Set(all.filter((r) => r.poolId).map((r) => r.id)).size).toBe(5);
    const matchedEvents = await prisma.rideEvent.groupBy({
      by: ['rideRequestId'],
      where: { eventType: 'RIDE_MATCHED' },
      _count: true,
    });
    expect(matchedEvents.every((g) => g._count === 1)).toBe(true);
  });
});
