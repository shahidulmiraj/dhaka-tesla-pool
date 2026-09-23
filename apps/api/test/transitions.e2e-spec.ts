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

describe('invalid state transitions are rejected', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jashim: Actor, nusrat: Actor, rafiq: Actor;
  let poolId: string, nusratRide: string, rafiqRide: string;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    [jashim, nusrat, rafiq] = await Promise.all(
      ['jashim', 'nusrat', 'rafiq'].map((n) => signUp(app, n as 'jashim')),
    );
    await goOnline(app, jashim).expect(200);
    nusratRide = (
      await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201)
    ).body.id;
    rafiqRide = (await requestRide(app, rafiq, { to: 'Gulshan 1' }).expect(201))
      .body.id;
    poolId = (await accept(app, jashim, nusratRide).expect(201)).body.id;
  });

  const expect409 = async (
    req: ReturnType<typeof poolAction>,
    message: string,
  ) => {
    const res = await req.expect(409);
    expect(res.body).toEqual({ code: 'INVALID_TRANSITION', message });
  };

  it('start from OPEN (skipped arrive)', () =>
    expect409(
      poolAction(app, jashim, poolId, 'start'),
      'Pool cannot move from OPEN to IN_PROGRESS',
    ));

  it('complete from DRIVER_ARRIVED', async () => {
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    await expect409(
      poolAction(app, jashim, poolId, 'complete'),
      'Pool cannot move from DRIVER_ARRIVED to COMPLETED',
    );
  });

  it('arrive twice (double click) succeeds once', async () => {
    const [a, b] = await Promise.all([
      poolAction(app, jashim, poolId, 'arrive'),
      poolAction(app, jashim, poolId, 'arrive'),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(
      await prisma.rideEvent.count({
        where: { poolId, eventType: 'POOL_DRIVER_ARRIVED' },
      }),
    ).toBe(1);
  });

  it('driver cancel from IN_PROGRESS, and complete twice', async () => {
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    await poolAction(app, jashim, poolId, 'start').expect(200);
    await expect409(
      poolAction(app, jashim, poolId, 'cancel'),
      'Pool cannot move from IN_PROGRESS to CANCELLED',
    );
    await poolAction(app, jashim, poolId, 'complete').expect(200);
    await expect409(
      poolAction(app, jashim, poolId, 'complete'),
      'Pool cannot move from COMPLETED to COMPLETED',
    );
  });

  it('passenger cancel from IN_PROGRESS and from COMPLETED', async () => {
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    await poolAction(app, jashim, poolId, 'start').expect(200);
    const during = await api(app)
      .post(`/api/v1/rides/${nusratRide}/cancel`)
      .set(auth(nusrat.token))
      .expect(409);
    expect(during.body).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'Ride cannot move from IN_PROGRESS to CANCELLED',
    });
    await poolAction(app, jashim, poolId, 'complete').expect(200);
    const after = await api(app)
      .post(`/api/v1/rides/${nusratRide}/cancel`)
      .set(auth(nusrat.token))
      .expect(409);
    expect(after.body.code).toBe('INVALID_TRANSITION');
  });

  it('happy path arrive -> start -> complete cascades to every member, events in order', async () => {
    const arrived = await poolAction(app, jashim, poolId, 'arrive').expect(200);
    expect(
      arrived.body.members.map((m: { status: string }) => m.status),
    ).toEqual(['DRIVER_ARRIVED', 'DRIVER_ARRIVED']);
    const started = await poolAction(app, jashim, poolId, 'start').expect(200);
    expect(started.body.status).toBe('IN_PROGRESS');
    expect(
      started.body.members.map((m: { status: string }) => m.status),
    ).toEqual(['IN_PROGRESS', 'IN_PROGRESS']);
    const done = await poolAction(app, jashim, poolId, 'complete').expect(200);
    expect(done.body.status).toBe('COMPLETED');
    expect(done.body.members.map((m: { status: string }) => m.status)).toEqual([
      'COMPLETED',
      'COMPLETED',
    ]);

    const poolTypes = done.body.events
      .filter((e: { rideId: string | null }) => !e.rideId)
      .map((e: { type: string }) => e.type);
    expect(poolTypes).toEqual([
      'POOL_CREATED',
      'POOL_DRIVER_ARRIVED',
      'POOL_STARTED',
      'POOL_COMPLETED',
    ]);

    const ride = await getRide(app, rafiq, rafiqRide).expect(200);
    expect(ride.body.events.map((e: { type: string }) => e.type)).toEqual([
      'RIDE_REQUESTED',
      'RIDE_MATCHED',
      'POOL_DRIVER_ARRIVED',
      'POOL_STARTED',
      'FARE_LOCKED',
      'POOL_COMPLETED',
      'PAYMENT_SETTLED',
    ]);
  });

  it('a passenger can join a pool that already arrived, as DRIVER_ARRIVED', async () => {
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    const shirin = await signUp(app, 'shirin');
    const res = await requestRide(app, shirin, { to: 'Gulshan 2' }).expect(201);
    expect(res.body).toMatchObject({
      status: 'DRIVER_ARRIVED',
      pool: { id: poolId, coPassengers: 2 },
    });
  });

  it('a request created while its only candidate pool has started stays REQUESTED', async () => {
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    await poolAction(app, jashim, poolId, 'start').expect(200);
    const shirin = await signUp(app, 'shirin');
    const res = await requestRide(app, shirin, { to: 'Gulshan 2' }).expect(201);
    expect(res.body).toMatchObject({ status: 'REQUESTED', pool: null });
  });
});
