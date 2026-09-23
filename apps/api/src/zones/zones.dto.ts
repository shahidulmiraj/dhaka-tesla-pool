import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class TripDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pickupZoneId!: number;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dropoffZoneId!: number;

  @ApiProperty({ example: 1, minimum: 1, maximum: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  seats!: number;
}

export class EstimateQueryDto extends TripDto {}
