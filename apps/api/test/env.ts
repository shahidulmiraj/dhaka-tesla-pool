import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Point everything at the test database before any Prisma client is created.
export function loadTestEnv() {
  const file = join(__dirname, '..', '.env');
  if (existsSync(file)) process.loadEnvFile(file);
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is required for e2e tests');
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
  process.env.NODE_ENV = 'test';
}
