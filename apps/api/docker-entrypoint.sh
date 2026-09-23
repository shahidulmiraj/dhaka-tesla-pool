#!/bin/sh
set -e
echo "Running migrations"
./node_modules/.bin/prisma migrate deploy
echo "Seeding (idempotent)"
node dist/seed.js
echo "Starting API"
exec node dist/main.js
