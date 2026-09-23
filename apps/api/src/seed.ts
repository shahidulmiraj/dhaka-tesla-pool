import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Idempotent: runs on every container boot. Upserts keyed by email / zone name /
// fixed UUIDs, and `update: {}` so a reboot never resets balances or history.

export const DEMO_PASSWORD = 'Dhaka2026!'; // synthetic, documented in README

export const ZONES = [
  { name: 'Banani', lat: 23.7937, lng: 90.4066 },
  { name: 'Gulshan 1', lat: 23.7808, lng: 90.4168 },
  { name: 'Gulshan 2', lat: 23.7925, lng: 90.4142 },
  { name: 'Mohakhali', lat: 23.7779, lng: 90.4018 },
  { name: 'Badda', lat: 23.7808, lng: 90.4262 },
  { name: 'Bashundhara', lat: 23.8135, lng: 90.4276 },
  { name: 'Tejgaon', lat: 23.7639, lng: 90.3958 },
  { name: 'Farmgate', lat: 23.7577, lng: 90.3897 },
  { name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
  { name: 'Mirpur 10', lat: 23.8069, lng: 90.3687 },
  { name: 'Uttara', lat: 23.8759, lng: 90.3795 },
  { name: 'Motijheel', lat: 23.733, lng: 90.4172 },
];

const CAST = [
  {
    email: 'jashim@teslapool.demo',
    fullName: 'Jashim Uddin',
    role: 'DRIVER',
    wallet: 0,
    vehicle: { name: 'Bullet', capacity: 3 },
  },
  {
    email: 'kamal@teslapool.demo',
    fullName: 'Kamal Hossain',
    role: 'DRIVER',
    wallet: 0,
    vehicle: { name: 'Rocket', capacity: 2 },
  },
  {
    email: 'nusrat@teslapool.demo',
    fullName: 'Nusrat Jahan',
    role: 'PASSENGER',
    wallet: 50000,
  },
  {
    email: 'rafiq@teslapool.demo',
    fullName: 'Rafiq Ahmed',
    role: 'PASSENGER',
    wallet: 0,
  },
  {
    email: 'shirin@teslapool.demo',
    fullName: 'Shirin Akter',
    role: 'PASSENGER',
    wallet: 3000,
  },
] as const;

// Yesterday's completed trip so history pages are not empty on first login.
const HISTORY_POOL_ID = '00000000-0000-4000-8000-000000000001';
const HISTORY_NUSRAT_RIDE_ID = '00000000-0000-4000-8000-000000000002';
const HISTORY_RAFIQ_RIDE_ID = '00000000-0000-4000-8000-000000000003';

export async function seed(prisma: PrismaClient) {
  for (const z of ZONES) {
    await prisma.zone.upsert({
      where: { name: z.name },
      update: {},
      create: z,
    });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Record<string, { id: string }> = {};
  for (const c of CAST) {
    users[c.email] = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        fullName: c.fullName,
        role: c.role,
        passwordHash,
        walletBalancePaisa: c.wallet,
        vehicle: 'vehicle' in c ? { create: c.vehicle } : undefined,
      },
    });
  }

  if (await prisma.pool.findUnique({ where: { id: HISTORY_POOL_ID } })) return;

  const zone = async (name: string) =>
    (await prisma.zone.findUniqueOrThrow({ where: { name } })).id;
  const [banani, mohakhali, gulshan1] = await Promise.all(
    ['Banani', 'Mohakhali', 'Gulshan 1'].map(zone),
  );
  const jashim = users['jashim@teslapool.demo'].id;
  const nusrat = users['nusrat@teslapool.demo'].id;
  const rafiq = users['rafiq@teslapool.demo'].id;
  const bullet = await prisma.vehicle.findUniqueOrThrow({
    where: { driverId: jashim },
  });
  const at = (minutes: number) =>
    new Date(Date.now() - 24 * 3600_000 + minutes * 60_000);

  await prisma.$transaction(async (tx) => {
    await tx.pool.create({
      data: {
        id: HISTORY_POOL_ID,
        driverId: jashim,
        vehicleId: bullet.id,
        vehicleName: bullet.name,
        capacity: bullet.capacity,
        seatsTaken: 2,
        pickupZoneId: banani,
        status: 'COMPLETED',
        createdAt: at(2),
      },
    });
    // Fares from the documented model: Nusrat 1824 m -> 5736 solo / 5189 pooled,
    // Rafiq 1770 m -> 5655 solo / 5124 pooled.
    const rides = [
      {
        id: HISTORY_NUSRAT_RIDE_ID,
        passengerId: nusrat,
        dropoffZoneId: mohakhali,
        distanceM: 1824,
        estimatedFarePaisa: 5736,
        finalFarePaisa: 5189,
        paymentMethod: 'TESLAPAY' as const,
        createdAt: at(0),
      },
      {
        id: HISTORY_RAFIQ_RIDE_ID,
        passengerId: rafiq,
        dropoffZoneId: gulshan1,
        distanceM: 1770,
        estimatedFarePaisa: 5655,
        finalFarePaisa: 5124,
        paymentMethod: 'CASH' as const,
        createdAt: at(1),
      },
    ];
    for (const r of rides) {
      await tx.rideRequest.create({
        data: {
          ...r,
          pickupZoneId: banani,
          seats: 1,
          status: 'COMPLETED',
          poolId: HISTORY_POOL_ID,
          paymentStatus: 'PAID',
        },
      });
    }
    const ev = (e: {
      rideRequestId?: string;
      poolId?: string;
      eventType: string;
      fromStatus?: string;
      toStatus?: string;
      actorUserId?: string | null;
      metadata?: object;
      minute: number;
    }) => {
      const { minute, ...data } = e;
      return { ...data, metadata: data.metadata ?? {}, createdAt: at(minute) };
    };
    await tx.rideEvent.createMany({
      data: [
        ev({
          rideRequestId: HISTORY_NUSRAT_RIDE_ID,
          eventType: 'RIDE_REQUESTED',
          toStatus: 'REQUESTED',
          actorUserId: nusrat,
          metadata: { seats: 1, estimatedFarePaisa: 5736 },
          minute: 0,
        }),
        ev({
          rideRequestId: HISTORY_RAFIQ_RIDE_ID,
          eventType: 'RIDE_REQUESTED',
          toStatus: 'REQUESTED',
          actorUserId: rafiq,
          metadata: { seats: 1, estimatedFarePaisa: 5655 },
          minute: 1,
        }),
        ev({
          poolId: HISTORY_POOL_ID,
          eventType: 'POOL_CREATED',
          toStatus: 'OPEN',
          actorUserId: jashim,
          metadata: { capacity: 3 },
          minute: 2,
        }),
        ev({
          rideRequestId: HISTORY_NUSRAT_RIDE_ID,
          poolId: HISTORY_POOL_ID,
          eventType: 'RIDE_MATCHED',
          fromStatus: 'REQUESTED',
          toStatus: 'MATCHED',
          actorUserId: jashim,
          metadata: { seats: 1 },
          minute: 2,
        }),
        ev({
          rideRequestId: HISTORY_RAFIQ_RIDE_ID,
          poolId: HISTORY_POOL_ID,
          eventType: 'RIDE_MATCHED',
          fromStatus: 'REQUESTED',
          toStatus: 'MATCHED',
          actorUserId: null,
          metadata: { seats: 1, via: 'sweep' },
          minute: 2,
        }),
        ev({
          poolId: HISTORY_POOL_ID,
          eventType: 'POOL_DRIVER_ARRIVED',
          fromStatus: 'OPEN',
          toStatus: 'DRIVER_ARRIVED',
          actorUserId: jashim,
          minute: 5,
        }),
        ev({
          poolId: HISTORY_POOL_ID,
          eventType: 'POOL_STARTED',
          fromStatus: 'DRIVER_ARRIVED',
          toStatus: 'IN_PROGRESS',
          actorUserId: jashim,
          minute: 7,
        }),
        ev({
          rideRequestId: HISTORY_NUSRAT_RIDE_ID,
          poolId: HISTORY_POOL_ID,
          eventType: 'FARE_LOCKED',
          actorUserId: jashim,
          metadata: { finalFarePaisa: 5189, members: 2 },
          minute: 7,
        }),
        ev({
          rideRequestId: HISTORY_RAFIQ_RIDE_ID,
          poolId: HISTORY_POOL_ID,
          eventType: 'FARE_LOCKED',
          actorUserId: jashim,
          metadata: { finalFarePaisa: 5124, members: 2 },
          minute: 7,
        }),
        ev({
          poolId: HISTORY_POOL_ID,
          eventType: 'POOL_COMPLETED',
          fromStatus: 'IN_PROGRESS',
          toStatus: 'COMPLETED',
          actorUserId: jashim,
          minute: 18,
        }),
        ev({
          rideRequestId: HISTORY_NUSRAT_RIDE_ID,
          poolId: HISTORY_POOL_ID,
          eventType: 'PAYMENT_SETTLED',
          actorUserId: jashim,
          metadata: {
            method: 'TESLAPAY',
            status: 'PAID',
            farePaisa: 5189,
            walletBefore: 55189,
            walletAfter: 50000,
          },
          minute: 18,
        }),
        ev({
          rideRequestId: HISTORY_RAFIQ_RIDE_ID,
          poolId: HISTORY_POOL_ID,
          eventType: 'PAYMENT_SETTLED',
          actorUserId: jashim,
          metadata: { method: 'CASH', status: 'PAID', farePaisa: 5124 },
          minute: 18,
        }),
      ],
    });
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => console.log('Seed complete'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
