import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from '../common/decorators';
import { DomainError } from '../common/errors';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new DomainError('UNAUTHENTICATED', 'Sign in required');
    }
    try {
      const payload = await this.jwt.verifyAsync<AuthUser>(token);
      req.user = { sub: payload.sub, role: payload.role };
    } catch {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Session expired or invalid; sign in again',
      );
    }
    return true;
  }
}
