import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  const prisma = app.get(PrismaService);
  for (const z of await prisma.zone.findMany()) zoneIds.set(z.name, z.id);
  return { app, prisma };
}

// Zones are immutable reference data, so ids are cached once per test file.
const zoneIds = new Map<string, number>();
export function zoneId(name: string) {
  const id = zoneIds.get(name);
  if (!id) throw new Error(`Unknown zone ${name}`);
  return id;
}

export async function resetDb(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE ride_events, ride_requests, pools, vehicles, users RESTART IDENTITY CASCADE',
  );
}

export const api = (app: INestApplication) => request(app.getHttpServer());
export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
