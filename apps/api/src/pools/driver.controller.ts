import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthUser } from '../common/decorators';
import { PageQueryDto } from '../rides/rides.dto';
import { AcceptDto, DriverStatusDto, OpenRequestsQueryDto } from './pools.dto';
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

  @Patch('zone')
  zone(@CurrentUser() user: AuthUser, @Body() dto: OpenRequestsQueryDto) {
    return this.pools.setServingZone(user.sub, dto.pickupZoneId);
  }

  @Get('requests')
  requests(@CurrentUser() user: AuthUser, @Query() q: OpenRequestsQueryDto) {
    return this.pools.openRequests(
      user.sub,
      q.pickupZoneId,
      q.dropoffZoneId,
    );
  }

  @Post('pools')
  accept(@CurrentUser() user: AuthUser, @Body() dto: AcceptDto) {
    return this.pools.accept(user.sub, dto.requestId);
  }

  @Get('pools')
  list(@CurrentUser() user: AuthUser, @Query() page: PageQueryDto) {
    return this.pools.list(user.sub, page);
  }

  @Get('pools/active')
  async active(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pool = await this.pools.active(user.sub);
    if (!pool) res.status(204);
    return pool ?? undefined;
  }

  @Get('pools/:id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pools.detail(user.sub, id);
  }

  @Post('pools/:id/arrive')
  @HttpCode(200)
  arrive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pools.arrive(user.sub, id);
  }

  @Post('pools/:id/start')
  @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.pools.start(user.sub, id);
  }

  @Post('pools/:id/complete')
  @HttpCode(200)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pools.complete(user.sub, id);
  }

  @Post('pools/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pools.cancel(user.sub, id);
  }
}
