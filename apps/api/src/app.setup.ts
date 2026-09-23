import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DomainExceptionFilter } from './common/domain-exception.filter';
import { DomainError } from './common/errors';

// Shared by main.ts and the e2e tests so tests exercise the real pipeline.
export function configureApp(app: INestApplication) {
  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? '').split(','),
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new DomainError(
          'VALIDATION_ERROR',
          'Request is invalid',
          errors.flatMap(function flat(e): {
            field: string;
            problems: string[];
          }[] {
            const own = e.constraints
              ? [{ field: e.property, problems: Object.values(e.constraints) }]
              : [];
            return [...own, ...(e.children ?? []).flatMap(flat)];
          }),
        ),
    }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.enableShutdownHooks();
  return app;
}
