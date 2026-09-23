import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, Vehicle } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DomainError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, SignupDto } from './auth.dto';

export const toUserView = (u: User & { vehicle?: Vehicle | null }) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  role: u.role,
  walletBalancePaisa: u.walletBalancePaisa,
  isOnline: u.isOnline,
  vehicle: u.vehicle
    ? { id: u.vehicle.id, name: u.vehicle.name, capacity: u.vehicle.capacity }
    : null,
});

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    if (dto.role === 'PASSENGER' && dto.vehicle) {
      throw new DomainError(
        'VALIDATION_ERROR',
        'Passengers cannot register a vehicle',
      );
    }
    // Unique index on email turns a duplicate into P2002 -> 409 EMAIL_TAKEN.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(dto.password, 10),
        fullName: dto.fullName.trim(),
        role: dto.role,
        vehicle: dto.vehicle ? { create: dto.vehicle } : undefined,
      },
      include: { vehicle: true },
    });
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: { vehicle: true },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new DomainError(
        'INVALID_CREDENTIALS',
        'Email or password is incorrect',
      );
    }
    return this.session(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { vehicle: true },
    });
    if (!user)
      throw new DomainError('UNAUTHENTICATED', 'Account no longer exists');
    return toUserView(user);
  }

  private async session(user: User & { vehicle: Vehicle | null }) {
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { token, user: toUserView(user) };
  }
}
