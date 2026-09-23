import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthUser } from '../common/decorators';
import { DriverStatusDto, OpenRequestsQueryDto } from './pools.dto';
import { PoolsService } from './pools.service';

@ApiTags('driver')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
@Controller('driver')
export class DriverController {
  constructor(private readonly pools: PoolsService) {}

  @Patch('status')
  status(@CurrentUser() user: AuthUser, @Body() dto: DriverStatusDto) {
    return this.pools.setOnline(user.sub, dto.online);
  }

  @Get('requests')
  requests(@CurrentUser() user: AuthUser, @Query() q: OpenRequestsQueryDto) {
    return this.pools.openRequests(user.sub, q.pickupZoneId);
  }
}
