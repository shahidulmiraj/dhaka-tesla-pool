import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { ZONES } from '../src/seed';
import { loadTestEnv } from './env';

export default async function globalSetup() {
  loadTestEnv();
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
  // Zones are immutable reference data: seed once, never truncated.
  const prisma = new PrismaClient();
  for (const z of ZONES) {
    await prisma.zone.upsert({
      where: { name: z.name },
      update: {},
      create: z,
    });
  }
  await prisma.$disconnect();
}
