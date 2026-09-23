import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { api, auth, zoneId } from './app';

// The PRD's cast, created through the real signup endpoint.
export const PASSWORD = 'Dhaka2026!';

export interface Actor {
  token: string;
  user: { id: string; fullName: string; role: string };
}

type Person = {
  email: string;
  fullName: string;
  role: 'PASSENGER' | 'DRIVER';
  wallet?: number;
  vehicle?: { name: string; capacity: number };
};

export const PEOPLE = {
  jashim: {
    email: 'jashim@teslapool.demo',
    fullName: 'Jashim Uddin',
    role: 'DRIVER',
    vehicle: { name: 'Bullet', capacity: 3 },
  },
  kamal: {
    email: 'kamal@teslapool.demo',
    fullName: 'Kamal Hossain',
    role: 'DRIVER',
    vehicle: { name: 'Rocket', capacity: 2 },
  },
  nusrat: {
    email: 'nusrat@teslapool.demo',
    fullName: 'Nusrat Jahan',
    role: 'PASSENGER',
    wallet: 50000,
  },
  rafiq: {
    email: 'rafiq@teslapool.demo',
    fullName: 'Rafiq Ahmed',
    role: 'PASSENGER',
  },
  shirin: {
    email: 'shirin@teslapool.demo',
    fullName: 'Shirin Akter',
    role: 'PASSENGER',
    wallet: 3000,
  },
  // Extra Banani commuters for the capacity and race tests.
  tania: {
    email: 'tania@teslapool.demo',
    fullName: 'Tania Rahman',
    role: 'PASSENGER',
  },
  farhan: {
    email: 'farhan@teslapool.demo',
    fullName: 'Farhan Kabir',
    role: 'PASSENGER',
  },
  mim: {
    email: 'mim@teslapool.demo',
    fullName: 'Mim Chowdhury',
    role: 'PASSENGER',
  },
  sabbir: {
    email: 'sabbir@teslapool.demo',
    fullName: 'Sabbir Hasan',
    role: 'PASSENGER',
  },
} satisfies Record<string, Person>;

export type Name = keyof typeof PEOPLE;

export async function signUp(
  app: INestApplication,
  name: Name,
): Promise<Actor> {
  const { wallet, ...body } = PEOPLE[name] as Person;
  const res = await api(app)
    .post('/api/v1/auth/signup')
    .send({ ...body, password: PASSWORD })
    .expect(201);
  if (wallet) {
    const prisma = app.get(PrismaService);
    await prisma.user.update({
      where: { id: res.body.user.id },
      data: { walletBalancePaisa: wallet },
    });
  }
  return res.body as Actor;
}

export interface TripInput {
  from?: string;
  to: string;
  seats?: number;
  paymentMethod?: 'CASH' | 'TESLAPAY';
}

// POST /rides as `who`; returns the supertest request so callers can chain .expect().
export function requestRide(
  app: INestApplication,
  who: Actor,
  trip: TripInput,
) {
  return api(app)
    .post('/api/v1/rides')
    .set(auth(who.token))
    .send({
      pickupZoneId: zoneId(trip.from ?? 'Banani'),
      dropoffZoneId: zoneId(trip.to),
      seats: trip.seats ?? 1,
      paymentMethod: trip.paymentMethod ?? 'CASH',
    });
}

export const goOnline = (app: INestApplication, driver: Actor, online = true) =>
  api(app)
    .patch('/api/v1/driver/status')
    .set(auth(driver.token))
    .send({ online });

export const accept = (
  app: INestApplication,
  driver: Actor,
  requestId: string,
) =>
  api(app)
    .post('/api/v1/driver/pools')
    .set(auth(driver.token))
    .send({ requestId });

export const poolAction = (
  app: INestApplication,
  driver: Actor,
  poolId: string,
  action: 'arrive' | 'start' | 'complete' | 'cancel',
) =>
  api(app)
    .post(`/api/v1/driver/pools/${poolId}/${action}`)
    .set(auth(driver.token));

export const getRide = (app: INestApplication, who: Actor, rideId: string) =>
  api(app).get(`/api/v1/rides/${rideId}`).set(auth(who.token));
