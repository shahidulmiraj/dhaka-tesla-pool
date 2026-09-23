import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EstimateQueryDto } from './zones.dto';
import { ZonesService } from './zones.service';

@ApiTags('public')
@Controller()
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @Get('zones')
  list() {
    return this.zones.list();
  }

  @Get('fare/estimate')
  async estimate(@Query() q: EstimateQueryDto) {
    const { distanceM, quote } = await this.zones.trip(
      q.pickupZoneId,
      q.dropoffZoneId,
      q.seats,
    );
    return {
      distanceM,
      seats: q.seats,
      soloFarePaisa: quote.solo,
      pooledFarePaisa: quote.pooled,
      breakdown: {
        baseFarePaisa: quote.baseFare,
        distanceChargePaisa: quote.distanceCharge,
        poolDiscountPaisa: quote.poolDiscount,
      },
    };
  }
}
