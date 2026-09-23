import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class VehicleDto {
  @ApiProperty({ example: 'Bullet' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 6 })
  @IsInt()
  @Min(1)
  @Max(6)
  capacity!: number;
}

export class SignupDto {
  @ApiProperty({ example: 'nusrat@teslapool.demo' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt ignores bytes beyond 72
  password!: string;

  @ApiProperty({ example: 'Nusrat Jahan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  fullName!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional({
    type: VehicleDto,
    description: 'Required iff role = DRIVER',
  })
  @ValidateIf(
    (o: SignupDto) => o.role === UserRole.DRIVER || o.vehicle !== undefined,
  )
  @IsDefined({ message: 'vehicle is required for drivers' })
  @ValidateNested()
  @Type(() => VehicleDto)
  vehicle?: VehicleDto;
}

export class LoginDto {
  @ApiProperty({ example: 'nusrat@teslapool.demo' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Dhaka2026!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
