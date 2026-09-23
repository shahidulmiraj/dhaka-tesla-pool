import { HttpStatus } from '@nestjs/common';

// Services throw DomainError with a stable code; the filter maps it to HTTP.
// Tests assert on `code`, the UI shows `message`.
export const ERROR_STATUS = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  SAME_ZONE: HttpStatus.BAD_REQUEST,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  ACTIVE_RIDE_EXISTS: HttpStatus.CONFLICT,
  INVALID_TRANSITION: HttpStatus.CONFLICT,
  NO_VEHICLE: HttpStatus.CONFLICT,
  DRIVER_OFFLINE: HttpStatus.CONFLICT,
  DRIVER_HAS_ACTIVE_POOL: HttpStatus.CONFLICT,
  ACTIVE_POOL_EXISTS: HttpStatus.CONFLICT,
  REQUEST_NOT_AVAILABLE: HttpStatus.CONFLICT,
  SEATS_EXCEED_CAPACITY: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown[],
  ) {
    super(message);
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}
