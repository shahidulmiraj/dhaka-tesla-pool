import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { api, auth, createApp, resetDb, zoneId } from './app';
import {
  accept,
  Actor,
  goOnline,
  poolAction,
  requestRide,
  signUp,
} from './cast';

describe("users can't read or modify another user's ride", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let nusrat: Actor, rafiq: Actor, jashim: Actor;
  let nusratRideId: string;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    [nusrat, rafiq, jashim] = await Promise.all([
      signUp(app, 'nusrat'),
      signUp(app, 'rafiq'),
      signUp(app, 'jashim'),
    ]);
    nusratRideId = (
      await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201)
    ).body.id;
  });

  it("Rafiq cannot read or cancel Nusrat's ride (403, not 404)", async () => {
    const read = await api(app)
      .get(`/api/v1/rides/${nusratRideId}`)
      .set(auth(rafiq.token))
      .expect(403);
    expect(read.body.code).toBe('FORBIDDEN');
    const cancel = await api(app)
      .post(`/api/v1/rides/${nusratRideId}/cancel`)
      .set(auth(rafiq.token))
      .expect(403);
    expect(cancel.body.code).toBe('FORBIDDEN');
    const ride = await prisma.rideRequest.findUniqueOrThrow({
      where: { id: nusratRideId },
    });
    expect(ride.status).toBe('REQUESTED');
  });

  it('Jashim (a driver) cannot use passenger endpoints', async () => {
    const res = await requestRide(app, jashim, { to: 'Mohakhali' }).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
    await api(app)
      .get(`/api/v1/rides/${nusratRideId}`)
      .set(auth(jashim.token))
      .expect(403);
  });

  it('requires a token', async () => {
    const res = await api(app).get('/api/v1/rides').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('rejects smuggled status or fare fields in the body', async () => {
    const [banani, mohakhali] = [zoneId('Banani'), zoneId('Mohakhali')];
    await api(app)
      .post(`/api/v1/rides/${nusratRideId}/cancel`)
      .set(auth(nusrat.token))
      .expect(200);
    const res = await api(app)
      .post('/api/v1/rides')
      .set(auth(nusrat.token))
      .send({
        pickupZoneId: banani,
        dropoffZoneId: mohakhali,
        seats: 1,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        finalFarePaisa: 1,
      })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it("Kamal cannot read or drive Jashim's pool; Nusrat cannot call driver endpoints", async () => {
    const kamal = await signUp(app, 'kamal');
    await goOnline(app, jashim).expect(200);
    const poolId = (await accept(app, jashim, nusratRideId).expect(201)).body
      .id;

    const read = await api(app)
      .get(`/api/v1/driver/pools/${poolId}`)
      .set(auth(kamal.token))
      .expect(403);
    expect(read.body.code).toBe('FORBIDDEN');
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    const start = await poolAction(app, kamal, poolId, 'start').expect(403);
    expect(start.body.code).toBe('FORBIDDEN');
    expect(
      (await prisma.pool.findUniqueOrThrow({ where: { id: poolId } })).status,
    ).toBe('DRIVER_ARRIVED');

    const asPassenger = await accept(app, nusrat, nusratRideId).expect(403);
    expect(asPassenger.body.code).toBe('FORBIDDEN');
  });
});
