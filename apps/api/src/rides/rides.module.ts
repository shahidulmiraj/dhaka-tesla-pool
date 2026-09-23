import { Module } from '@nestjs/common';
import { PoolsModule } from '../pools/pools.module';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';

@Module({
  imports: [PoolsModule],
  controllers: [RidesController],
  providers: [RidesService],
})
export class RidesModule {}
