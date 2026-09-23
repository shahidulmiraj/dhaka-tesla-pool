import {
  Body,
  Controller,
  Get,
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

  @Get('requests')
  requests(@CurrentUser() user: AuthUser, @Query() q: OpenRequestsQueryDto) {
    return this.pools.openRequests(user.sub, q.pickupZoneId);
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
}
