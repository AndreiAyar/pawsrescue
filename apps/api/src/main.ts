import { MikroORM } from '@mikro-orm/core';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  ensureUploadsDir,
  UPLOADS_ROUTE_PREFIX,
} from './uploads/upload-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const uploadsDir = ensureUploadsDir();
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: false,
  });
  app.enableShutdownHooks();

  app.useStaticAssets(uploadsDir, {
    prefix: `${UPLOADS_ROUTE_PREFIX}/`,
  });

  const orm = app.get(MikroORM);
  await orm.getMigrator().up();

  await app.listen(process.env.PORT ?? 3015, '0.0.0.0');
}

void bootstrap();
