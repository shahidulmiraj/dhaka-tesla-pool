const REQUIRED = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'CORS_ORIGIN',
] as const;

// Fail fast at boot: a missing variable is a deploy error, not a runtime surprise.
export function validateEnv(env: Record<string, unknown>) {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  return env;
}
