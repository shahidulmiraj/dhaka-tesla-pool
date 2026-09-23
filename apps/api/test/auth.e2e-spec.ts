import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { api, auth, createApp, resetDb } from './app';
import { PASSWORD, signUp } from './cast';

describe('auth', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDb(prisma));

  it('signs Nusrat up, logs her in and returns her profile without the hash', async () => {
    const { token, user } = await signUp(app, 'nusrat');
    expect(user).toMatchObject({
      email: 'nusrat@teslapool.demo',
      role: 'PASSENGER',
      vehicle: null,
    });
    expect(user).not.toHaveProperty('passwordHash');

    const login = await api(app)
      .post('/api/v1/auth/login')
      .send({ email: 'Nusrat@TeslaPool.demo', password: PASSWORD })
      .expect(200);
    expect(login.body.token).toEqual(expect.any(String));

    const me = await api(app)
      .get('/api/v1/auth/me')
      .set(auth(token))
      .expect(200);
    expect(me.body).toMatchObject({
      fullName: 'Nusrat Jahan',
      walletBalancePaisa: 50000,
    });
  });

  it('gives Jashim his Bullet on signup', async () => {
    const { token } = await signUp(app, 'jashim');
    const me = await api(app)
      .get('/api/v1/auth/me')
      .set(auth(token))
      .expect(200);
    expect(me.body).toMatchObject({
      role: 'DRIVER',
      isOnline: false,
      vehicle: { name: 'Bullet', capacity: 3 },
    });
  });

  it('rejects the same email in a different case with EMAIL_TAKEN', async () => {
    await signUp(app, 'rafiq');
    const res = await api(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'RAFIQ@teslapool.demo',
        password: PASSWORD,
        fullName: 'Rafiq Again',
        role: 'PASSENGER',
      })
      .expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    await signUp(app, 'shirin');
    const res = await api(app)
      .post('/api/v1/auth/login')
      .send({ email: 'shirin@teslapool.demo', password: 'not-her-password' })
      .expect(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('requires a vehicle for driver signup', async () => {
    const res = await api(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'kamal@teslapool.demo',
        password: PASSWORD,
        fullName: 'Kamal Hossain',
        role: 'DRIVER',
      })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'vehicle' })]),
    );
  });

  it('rejects vehicle capacity outside 1..6 and unknown fields', async () => {
    const base = {
      email: 'kamal@teslapool.demo',
      password: PASSWORD,
      fullName: 'Kamal Hossain',
      role: 'DRIVER',
    };
    await api(app)
      .post('/api/v1/auth/signup')
      .send({ ...base, vehicle: { name: 'Rocket', capacity: 9 } })
      .expect(400);
    const res = await api(app)
      .post('/api/v1/auth/signup')
      .send({
        ...base,
        vehicle: { name: 'Rocket', capacity: 2 },
        walletBalancePaisa: 999999,
      })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHENTICATED without or with a bad token', async () => {
    const none = await api(app).get('/api/v1/auth/me').expect(401);
    expect(none.body.code).toBe('UNAUTHENTICATED');
    await api(app).get('/api/v1/auth/me').set(auth('not.a.jwt')).expect(401);
  });
});
