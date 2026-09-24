-- AlterTable
ALTER TABLE "users" ADD COLUMN     "serving_zone_id" INTEGER;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_serving_zone_id_fkey" FOREIGN KEY ("serving_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
