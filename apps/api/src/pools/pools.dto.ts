import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsUUID, Min } from 'class-validator';

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
}

export class AcceptDto {
  @ApiProperty()
  @IsUUID()
  requestId!: string;
}
