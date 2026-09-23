import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller';
import { PoolsService } from './pools.service';

@Module({
  controllers: [DriverController],
  providers: [PoolsService],
  exports: [PoolsService],
})
export class PoolsModule {}
