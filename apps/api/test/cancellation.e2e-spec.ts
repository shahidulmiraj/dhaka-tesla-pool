import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { api, auth, createApp, resetDb } from './app';
import {
  accept,
  Actor,
  getRide,
  goOnline,
  poolAction,
  requestRide,
  signUp,
} from './cast';

describe('cancellation rules hold', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jashim: Actor, kamal: Actor, nusrat: Actor, rafiq: Actor, shirin: Actor;
  let nusratRide: string, rafiqRide: string;

  const cancelRide = (who: Actor, id: string) =>
    api(app).post(`/api/v1/rides/${id}/cancel`).set(auth(who.token));

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    [jashim, kamal, nusrat, rafiq, shirin] = await Promise.all(
      (['jashim', 'kamal', 'nusrat', 'rafiq', 'shirin'] as const).map((n) =>
        signUp(app, n),
      ),
    );
    await goOnline(app, jashim).expect(200);
    nusratRide = (
      await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201)
    ).body.id;
    rafiqRide = (await requestRide(app, rafiq, { to: 'Gulshan 1' }).expect(201))
      .body.id;
  });

  it('Nusrat leaves a MATCHED pool: seat freed, pool stays OPEN; Rafiq leaving empties it (SYSTEM cancel)', async () => {
    const poolId = (await accept(app, jashim, nusratRide).expect(201)).body.id;

    const left = await cancelRide(nusrat, nusratRide).expect(200);
    expect(left.body).toMatchObject({
      status: 'CANCELLED',
      cancelledBy: 'PASSENGER',
      pool: null,
    });
    expect(left.body.events.map((e: { type: string }) => e.type)).toEqual([
      'RIDE_REQUESTED',
      'RIDE_MATCHED',
      'RIDE_CANCELLED',
    ]);
    let pool = await prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
    expect(pool).toMatchObject({ status: 'OPEN', seatsTaken: 1 });

    await cancelRide(rafiq, rafiqRide).expect(200);
    pool = await prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
    expect(pool).toMatchObject({ status: 'CANCELLED', seatsTaken: 0 });
    const auto = await prisma.rideEvent.findFirstOrThrow({
      where: { poolId, eventType: 'POOL_CANCELLED' },
    });
    expect(auto).toMatchObject({
      actorUserId: null,
      fromStatus: 'OPEN',
      metadata: { reason: 'EMPTY', cancelledBy: 'SYSTEM' },
    });

    // Jashim is free to accept again.
    const shirinRide = (
      await requestRide(app, shirin, { to: 'Gulshan 2' }).expect(201)
    ).body.id;
    await accept(app, jashim, shirinRide).expect(201);
  });

  it('driver cancel reverts both members to REQUESTED; Kamal then sweeps them into Rocket', async () => {
    const poolId = (await accept(app, jashim, nusratRide).expect(201)).body.id;
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    const cancelled = await poolAction(app, jashim, poolId, 'cancel').expect(
      200,
    );
    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      seatsTaken: 0,
      members: [],
    });

    for (const id of [nusratRide, rafiqRide]) {
      const r = await prisma.rideRequest.findUniqueOrThrow({ where: { id } });
      expect(r).toMatchObject({
        status: 'REQUESTED',
        poolId: null,
        cancelledBy: null,
      });
    }
    const unmatched = await prisma.rideEvent.findMany({
      where: { eventType: 'RIDE_UNMATCHED' },
    });
    expect(unmatched).toHaveLength(2);
    expect(
      unmatched.every(
        (e) => e.poolId === poolId && e.fromStatus === 'DRIVER_ARRIVED',
      ),
    ).toBe(true);

    const nusratView = await getRide(app, nusrat, nusratRide).expect(200);
    expect(nusratView.body.events.map((e: { type: string }) => e.type)).toEqual(
      [
        'RIDE_REQUESTED',
        'RIDE_MATCHED',
        'POOL_DRIVER_ARRIVED',
        'POOL_CANCELLED',
        'RIDE_UNMATCHED',
      ],
    );

    await goOnline(app, kamal).expect(200);
    const rocket = await accept(app, kamal, rafiqRide).expect(201);
    expect(rocket.body).toMatchObject({ vehicleName: 'Rocket', seatsTaken: 2 });
    expect(
      rocket.body.members
        .map((m: { passengerName: string }) => m.passengerName)
        .sort(),
    ).toEqual(['Nusrat Jahan', 'Rafiq Ahmed']);
  });

  it('one of three leaves after DRIVER_ARRIVED; the remaining two still get the pooled fare at start', async () => {
    await requestRide(app, shirin, { to: 'Gulshan 2' }).expect(201);
    const poolId = (await accept(app, jashim, nusratRide).expect(201)).body.id;
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    await cancelRide(nusrat, nusratRide).expect(200);
    const pool = await prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
    expect(pool).toMatchObject({ status: 'DRIVER_ARRIVED', seatsTaken: 2 });
    const started = await poolAction(app, jashim, poolId, 'start').expect(200);
    expect(
      started.body.members.map((m: { farePaisa: number }) => m.farePaisa),
    ).toEqual([5124, 3942]);
  });

  it('passenger may cancel after DRIVER_ARRIVED but not after IN_PROGRESS', async () => {
    const poolId = (await accept(app, jashim, nusratRide).expect(201)).body.id;
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    await cancelRide(rafiq, rafiqRide).expect(200);
    await poolAction(app, jashim, poolId, 'start').expect(200);
    const res = await cancelRide(nusrat, nusratRide).expect(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  it('driver accepting a request cancelled a moment ago gets REQUEST_NOT_AVAILABLE, no orphan pool', async () => {
    await cancelRide(nusrat, nusratRide).expect(200);
    const res = await accept(app, jashim, nusratRide).expect(409);
    expect(res.body.code).toBe('REQUEST_NOT_AVAILABLE');
    expect(await prisma.pool.count()).toBe(0);
  });

  it('passenger cancel racing driver start: exactly one wins', async () => {
    const poolId = (await accept(app, jashim, nusratRide).expect(201)).body.id;
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    const [c, s] = await Promise.all([
      cancelRide(nusrat, nusratRide),
      poolAction(app, jashim, poolId, 'start'),
    ]);
    expect(s.status).toBe(200);
    const ride = await prisma.rideRequest.findUniqueOrThrow({
      where: { id: nusratRide },
    });
    if (c.status === 200) expect(ride.status).toBe('CANCELLED');
    else expect([c.status, ride.status]).toEqual([409, 'IN_PROGRESS']);
  });
});
