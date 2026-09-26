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
    const discount3 = Math.round(0.3 * quote.distanceCharge);
    const discountMax = Math.round(0.5 * quote.distanceCharge);
    return {
      distanceM,
      seats: q.seats,
      soloFarePaisa: quote.solo,
      pooled3FarePaisa: quote.pooled3,   // 3 requests = 30 % off distance charge
      pooledMaxFarePaisa: quote.pooledMax, // 5+ requests = 50 % off (max discount)
      breakdown: {
        baseFarePaisa: quote.baseFare,
        distanceChargePaisa: quote.distanceCharge,
        // Show the 3-pool discount as the "standard" preview breakdown
        poolDiscount3Paisa: discount3,
        poolDiscountMaxPaisa: discountMax,
      },
    };
  }
}
