import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ensureUploadsDir, UPLOADS_ROUTE_PREFIX } from './uploads/upload-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const uploadsDir = ensureUploadsDir();

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  app.useStaticAssets(uploadsDir, {
    prefix: `${UPLOADS_ROUTE_PREFIX}/`,
  });

  await app.listen(process.env.PORT ?? 3015);
}

void bootstrap();
