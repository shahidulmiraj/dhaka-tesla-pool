-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PASSENGER', 'DRIVER');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('OPEN', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TESLAPAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('PASSENGER', 'DRIVER', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "wallet_balance_paisa" INTEGER NOT NULL DEFAULT 0,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_requests" (
    "id" UUID NOT NULL,
    "passenger_id" UUID NOT NULL,
    "pickup_zone_id" INTEGER NOT NULL,
    "dropoff_zone_id" INTEGER NOT NULL,
    "seats" SMALLINT NOT NULL,
    "distance_m" INTEGER NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "pool_id" UUID,
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_status" "PaymentStatus",
    "estimated_fare_paisa" INTEGER NOT NULL,
    "final_fare_paisa" INTEGER,
    "cancelled_by" "CancelledBy",
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "vehicle_name" TEXT NOT NULL,
    "capacity" SMALLINT NOT NULL,
    "seats_taken" SMALLINT NOT NULL DEFAULT 0,
    "pickup_zone_id" INTEGER NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_events" (
    "id" SERIAL NOT NULL,
    "ride_request_id" UUID,
    "pool_id" UUID,
    "event_type" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_user_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_driver_id_key" ON "vehicles"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "zones_name_key" ON "zones"("name");

-- CreateIndex
CREATE INDEX "ride_requests_passenger_id_created_at_idx" ON "ride_requests"("passenger_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ride_requests_pool_id_idx" ON "ride_requests"("pool_id");

-- CreateIndex
CREATE INDEX "ride_requests_pickup_zone_id_status_idx" ON "ride_requests"("pickup_zone_id", "status");

-- CreateIndex
CREATE INDEX "pools_driver_id_created_at_idx" ON "pools"("driver_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "pools_pickup_zone_id_status_idx" ON "pools"("pickup_zone_id", "status");

-- CreateIndex
CREATE INDEX "ride_events_ride_request_id_created_at_idx" ON "ride_events"("ride_request_id", "created_at");

-- CreateIndex
CREATE INDEX "ride_events_pool_id_created_at_idx" ON "ride_events"("pool_id", "created_at");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_pickup_zone_id_fkey" FOREIGN KEY ("pickup_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_dropoff_zone_id_fkey" FOREIGN KEY ("dropoff_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_pickup_zone_id_fkey" FOREIGN KEY ("pickup_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written: invariants Prisma's schema language cannot express.
-- These must hold even if a service is wrong. Never `prisma db push`.
-- ---------------------------------------------------------------------------
ALTER TABLE "users"         ADD CONSTRAINT users_wallet_nonneg   CHECK (wallet_balance_paisa >= 0);
ALTER TABLE "vehicles"      ADD CONSTRAINT vehicles_capacity_rng CHECK (capacity BETWEEN 1 AND 6);
ALTER TABLE "ride_requests" ADD CONSTRAINT rr_seats_rng          CHECK (seats BETWEEN 1 AND 6);
ALTER TABLE "ride_requests" ADD CONSTRAINT rr_distinct_zones     CHECK (pickup_zone_id <> dropoff_zone_id);
ALTER TABLE "ride_requests" ADD CONSTRAINT rr_pool_iff_matched
  CHECK ((pool_id IS NOT NULL) = (status IN ('MATCHED','DRIVER_ARRIVED','IN_PROGRESS','COMPLETED')));
ALTER TABLE "ride_requests" ADD CONSTRAINT rr_fare_iff_started
  CHECK ((final_fare_paisa IS NOT NULL) = (status IN ('IN_PROGRESS','COMPLETED')));
ALTER TABLE "pools"         ADD CONSTRAINT pools_capacity_rng    CHECK (capacity BETWEEN 1 AND 6);
ALTER TABLE "pools"         ADD CONSTRAINT pools_seats_within_capacity
  CHECK (seats_taken >= 0 AND seats_taken <= capacity);
ALTER TABLE "ride_events"   ADD CONSTRAINT ev_has_subject
  CHECK (ride_request_id IS NOT NULL OR pool_id IS NOT NULL);

-- One active request per passenger (double-submit -> 23505 -> 409 ACTIVE_RIDE_EXISTS)
CREATE UNIQUE INDEX rr_one_active_per_passenger ON "ride_requests" (passenger_id)
  WHERE status IN ('REQUESTED','MATCHED','DRIVER_ARRIVED','IN_PROGRESS');
-- One active pool per driver (double-accept -> 409)
CREATE UNIQUE INDEX pools_one_active_per_driver ON "pools" (driver_id)
  WHERE status IN ('OPEN','DRIVER_ARRIVED','IN_PROGRESS');
