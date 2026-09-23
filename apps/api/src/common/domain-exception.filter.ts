import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { DomainError, ErrorCode } from './errors';

const HTTP_CODES: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

// Unique violations that are business rules, keyed by index/column name.
const UNIQUE_CODES: [string, ErrorCode, string][] = [
  ['email', 'EMAIL_TAKEN', 'An account with this email already exists'],
  [
    'rr_one_active_per_passenger',
    'ACTIVE_RIDE_EXISTS',
    'You already have an active ride',
  ],
  ['passenger_id', 'ACTIVE_RIDE_EXISTS', 'You already have an active ride'],
  [
    'pools_one_active_per_driver',
    'DRIVER_HAS_ACTIVE_POOL',
    'You already have an active pool',
  ],
  ['driver_id', 'DRIVER_HAS_ACTIVE_POOL', 'You already have an active pool'],
];

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const e = this.toDomain(exception);
    if (e.status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    } else {
      this.logger.warn(`${e.code}: ${e.message}`);
    }
    res.status(e.status).json({
      code: e.code,
      message: e.message,
      ...(e.details ? { details: e.details } : {}),
    });
  }

  private toDomain(ex: unknown): DomainError {
    if (ex instanceof DomainError) return ex;
    if (ex instanceof Prisma.PrismaClientKnownRequestError) {
      if (ex.code === 'P2002') {
        const target = JSON.stringify(ex.meta?.target ?? '');
        const hit = UNIQUE_CODES.find(([key]) => target.includes(key));
        if (hit) return new DomainError(hit[1], hit[2]);
      }
      if (ex.code === 'P2025') return new DomainError('NOT_FOUND', 'Not found');
    }
    if (ex instanceof HttpException) {
      const status = ex.getStatus();
      const code =
        HTTP_CODES[status] ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION_ERROR');
      const body = ex.getResponse();
      const msg =
        typeof body === 'object' && body && 'message' in body
          ? (body as { message: unknown }).message
          : ex.message;
      return new DomainError(
        code,
        Array.isArray(msg) ? msg.join('; ') : String(msg),
      );
    }
    return new DomainError('INTERNAL', 'Something went wrong');
  }
}
