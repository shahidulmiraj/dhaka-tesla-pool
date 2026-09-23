import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  // Render terminates TLS in front of us: trust one proxy hop so req.ip (and the
  // throttler's per-IP limit) is the client, not the proxy.
  app.set('trust proxy', 1);
  app.useLogger(app.get(Logger));
  configureApp(app);

  const doc = new DocumentBuilder()
    .setTitle('Dhaka Tesla Pool API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));

  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}
void bootstrap();
