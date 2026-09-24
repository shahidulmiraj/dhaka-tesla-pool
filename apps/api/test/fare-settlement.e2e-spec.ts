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

describe("Nusrat's and Rafiq's pooled fares calculate correctly", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jashim: Actor, nusrat: Actor, rafiq: Actor, shirin: Actor;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    [jashim, nusrat, rafiq, shirin] = await Promise.all(
      (['jashim', 'nusrat', 'rafiq', 'shirin'] as const).map((n) =>
        signUp(app, n),
      ),
    );
    await goOnline(app, jashim).expect(200);
  });

  const runTrip = async (rides: string[]) => {
    const poolId = (await accept(app, jashim, rides[0]).expect(201)).body.id;
    await poolAction(app, jashim, poolId, 'arrive').expect(200);
    await poolAction(app, jashim, poolId, 'start').expect(200);
    return poolId;
  };

  it('locks 51.89 for Nusrat and 51.24 for Rafiq at start; each sees only their own', async () => {
    const n = (
      await requestRide(app, nusrat, {
        to: 'Mohakhali',
        paymentMethod: 'TESLAPAY',
      }).expect(201)
    ).body;
    const r = (await requestRide(app, rafiq, { to: 'Gulshan 1' }).expect(201))
      .body;
    expect([n.estimatedFarePaisa, r.estimatedFarePaisa]).toEqual([5736, 5655]);
    await runTrip([n.id, r.id]);

    const nv = await getRide(app, nusrat, n.id).expect(200);
    expect(nv.body).toMatchObject({
      status: 'IN_PROGRESS',
      finalFarePaisa: 5189,
      pool: { coPassengers: 1 },
    });
    expect(JSON.stringify(nv.body)).not.toMatch(/Rafiq|5124|Gulshan 1/);
    const rv = await getRide(app, rafiq, r.id).expect(200);
    expect(rv.body.finalFarePaisa).toBe(5124);
    expect(JSON.stringify(rv.body)).not.toMatch(/Nusrat|5189|Mohakhali/);
  });

  it('a solo pool pays the solo fare: no discount', async () => {
    const n = (await requestRide(app, nusrat, { to: 'Mohakhali' }).expect(201))
      .body;
    await runTrip([n.id]);
    expect(
      (await getRide(app, nusrat, n.id).expect(200)).body.finalFarePaisa,
    ).toBe(5736);
  });

  it('settles: Nusrat TeslaPay PAID (50000 -> 44811), Rafiq cash PAID, Shirin short -> PENDING', async () => {
    const n = (
      await requestRide(app, nusrat, {
        to: 'Mohakhali',
        paymentMethod: 'TESLAPAY',
      }).expect(201)
    ).body;
    await requestRide(app, rafiq, {
      to: 'Gulshan 1',
      paymentMethod: 'CASH',
    }).expect(201);
    const s = (
      await requestRide(app, shirin, {
        to: 'Gulshan 2',
        paymentMethod: 'TESLAPAY',
      }).expect(201)
    ).body;
    const poolId = await runTrip([n.id]);
    const done = await poolAction(app, jashim, poolId, 'complete').expect(200);

    expect(done.body.members.map((m: object) => m)).toEqual([
      expect.objectContaining({
        passengerName: 'Nusrat Jahan',
        farePaisa: 5189,
        paymentMethod: 'TESLAPAY',
        paymentStatus: 'PAID',
      }),
      expect.objectContaining({
        passengerName: 'Rafiq Ahmed',
        farePaisa: 5124,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
      }),
      expect.objectContaining({
        passengerName: 'Shirin Akter',
        farePaisa: 3942,
        paymentMethod: 'TESLAPAY',
        paymentStatus: 'PENDING',
      }),
    ]);
    expect(JSON.stringify(done.body)).not.toMatch(
      /walletBefore|walletAfter|@teslapool/,
    );
    // Bullet's last stop is the drop-off farthest from Banani: Mohakhali (1824 m).
    expect(done.body.endZone).toEqual({
      id: expect.any(Number),
      name: 'Mohakhali',
    });

    const wallet = async (a: Actor) =>
      (await api(app).get('/api/v1/auth/me').set(auth(a.token))).body
        .walletBalancePaisa;
    expect(await wallet(nusrat)).toBe(44811);
    expect(await wallet(shirin)).toBe(3000);

    const sv = await getRide(app, shirin, s.id).expect(200);
    expect(sv.body).toMatchObject({
      status: 'COMPLETED',
      paymentStatus: 'PENDING',
    });
    expect(sv.body.events.at(-1)).toMatchObject({
      type: 'PAYMENT_SETTLED',
      metadata: {
        method: 'TESLAPAY',
        status: 'PENDING',
        walletBefore: 3000,
        walletAfter: 3000,
        cashDue: true,
      },
    });
  });

  it('a wallet exactly equal to the fare pays and reaches 0', async () => {
    await prisma.user.update({
      where: { id: shirin.user.id },
      data: { walletBalancePaisa: 4178 },
    });
    const s = (
      await requestRide(app, shirin, {
        to: 'Gulshan 2',
        paymentMethod: 'TESLAPAY',
      }).expect(201)
    ).body;
    const poolId = await runTrip([s.id]);
    await poolAction(app, jashim, poolId, 'complete').expect(200);
    const me = await api(app).get('/api/v1/auth/me').set(auth(shirin.token));
    expect(me.body.walletBalancePaisa).toBe(0);
  });
});
