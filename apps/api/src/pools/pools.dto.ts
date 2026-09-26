import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class DriverStatusDto {
  @ApiProperty()
  @IsBoolean()
  online!: boolean;
}

export class OpenRequestsQueryDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pickupZoneId!: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dropoffZoneId?: number;
}

export class AcceptDto {
  @ApiProperty()
  @IsUUID()
  requestId!: string;
}
