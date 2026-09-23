import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, resetDb } from './app';
import { accept, Actor, goOnline, requestRide, signUp } from './cast';

describe("Bullet's capacity can never be exceeded", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jashim: Actor, nusrat: Actor, rafiq: Actor, shirin: Actor, tania: Actor;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    [jashim, nusrat, rafiq, shirin, tania] = await Promise.all(
      (['jashim', 'nusrat', 'rafiq', 'shirin', 'tania'] as const).map((n) =>
        signUp(app, n),
      ),
    );
    await goOnline(app, jashim).expect(200);
  });

  it('fills Bullet with Nusrat, Rafiq and Shirin; a fourth passenger waits', async () => {
    const n = await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201);
    await requestRide(app, rafiq, { to: 'Gulshan 1' }).expect(201);
    await requestRide(app, shirin, { to: 'Gulshan 2' }).expect(201);

    const pool = await accept(app, jashim, n.body.id).expect(201);
    expect(pool.body).toMatchObject({
      status: 'OPEN',
      vehicleName: 'Bullet',
      capacity: 3,
      seatsTaken: 3,
    });
    expect(
      pool.body.members.map((m: { passengerName: string }) => m.passengerName),
    ).toEqual(['Nusrat Jahan', 'Rafiq Ahmed', 'Shirin Akter']);
    expect(
      pool.body.members.every(
        (m: { status: string }) => m.status === 'MATCHED',
      ),
    ).toBe(true);

    const fourth = await requestRide(app, tania, { to: 'Gulshan 1' }).expect(
      201,
    );
    expect(fourth.body).toMatchObject({ status: 'REQUESTED', pool: null });
    const db = await prisma.pool.findUniqueOrThrow({
      where: { id: pool.body.id },
    });
    expect(db.seatsTaken).toBe(3);
  });

  it('does not seat a 2-seat request when only 1 seat is free', async () => {
    const n = await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201);
    await requestRide(app, rafiq, { to: 'Gulshan 1' }).expect(201);
    const pool = await accept(app, jashim, n.body.id).expect(201);
    expect(pool.body.seatsTaken).toBe(2);

    const two = await requestRide(app, shirin, {
      to: 'Gulshan 2',
      seats: 2,
    }).expect(201);
    expect(two.body).toMatchObject({ status: 'REQUESTED', pool: null });
  });

  it('leaves an incompatible destination out of the sweep (Uttara is 11 km from Mohakhali)', async () => {
    const n = await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201);
    const far = await requestRide(app, rafiq, { to: 'Uttara' }).expect(201);
    const pool = await accept(app, jashim, n.body.id).expect(201);
    expect(pool.body.seatsTaken).toBe(1);
    const r = await prisma.rideRequest.findUniqueOrThrow({
      where: { id: far.body.id },
    });
    expect(r).toMatchObject({ status: 'REQUESTED', poolId: null });
  });

  it('refuses a request with more seats than Bullet has (SEATS_EXCEED_CAPACITY)', async () => {
    const big = await requestRide(app, nusrat, {
      to: 'Mohakhali',
      seats: 4,
    }).expect(201);
    const res = await accept(app, jashim, big.body.id).expect(409);
    expect(res.body.code).toBe('SEATS_EXCEED_CAPACITY');
    expect(await prisma.pool.count()).toBe(0);
  });

  it('holds the line in the database alone: CHECK rejects seats_taken = 4', async () => {
    const n = await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201);
    const pool = await accept(app, jashim, n.body.id).expect(201);
    await expect(
      prisma.$executeRaw`UPDATE pools SET seats_taken = 4 WHERE id = ${pool.body.id}::uuid`,
    ).rejects.toThrow(/pools_seats_within_capacity/);
  });
});

describe('auto-join on request (trigger A) uses the same rule', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jashim: Actor, nusrat: Actor, rafiq: Actor, shirin: Actor, tania: Actor;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    [jashim, nusrat, rafiq, shirin, tania] = await Promise.all(
      (['jashim', 'nusrat', 'rafiq', 'shirin', 'tania'] as const).map((n) =>
        signUp(app, n),
      ),
    );
    await goOnline(app, jashim).expect(200);
  });

  it('Rafiq requesting after Jashim accepted Nusrat lands in the same pool', async () => {
    const n = await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201);
    const pool = await accept(app, jashim, n.body.id).expect(201);
    const r = await requestRide(app, rafiq, { to: 'Gulshan 1' }).expect(201);
    expect(r.body).toMatchObject({
      status: 'MATCHED',
      pool: {
        id: pool.body.id,
        driverName: 'Jashim Uddin',
        vehicleName: 'Bullet',
        coPassengers: 1,
      },
    });
    expect(r.body.events.map((e: { type: string }) => e.type)).toEqual([
      'RIDE_REQUESTED',
      'RIDE_MATCHED',
    ]);
  });

  it('an incompatible or oversized request does not auto-join', async () => {
    const n = await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201);
    await accept(app, jashim, n.body.id).expect(201);
    const far = await requestRide(app, rafiq, { to: 'Uttara' }).expect(201);
    expect(far.body.pool).toBeNull();
    const big = await requestRide(app, shirin, {
      to: 'Gulshan 2',
      seats: 3,
    }).expect(201);
    expect(big.body.pool).toBeNull();
    const fits = await requestRide(app, tania, {
      to: 'Gulshan 2',
      seats: 2,
    }).expect(201);
    expect(fits.body.status).toBe('MATCHED');
  });
});
