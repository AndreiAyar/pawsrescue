import 'reflect-metadata';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { LostPetsService } from '../lost-pets/lost-pets.service';

async function rebuildEmbeddings() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const orm = app.get(MikroORM);
    await orm.getMigrator().up();

    const result = await RequestContext.create(orm.em, () =>
      app.get(LostPetsService).rebuildEmbeddings(),
    );
    console.log(JSON.stringify(result, null, 2));

    if (result.failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void rebuildEmbeddings();
