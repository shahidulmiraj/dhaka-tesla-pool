import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { CreateRideDto, PageQueryDto } from './rides.dto';
import { RidesService } from './rides.service';

@ApiTags('passenger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PASSENGER')
@Controller('rides')
export class RidesController {
  constructor(private readonly rides: RidesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRideDto) {
    return this.rides.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() page: PageQueryDto) {
    return this.rides.list(user.sub, page);
  }

  @Get('active')
  async active(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ride = await this.rides.active(user.sub);
    if (!ride) res.status(204);
    return ride ?? undefined;
  }

  @Get(':id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rides.detail(user.sub, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rides.cancel(user.sub, id);
  }
}
