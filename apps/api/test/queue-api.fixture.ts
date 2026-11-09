import type { Server } from 'node:http';
// A real Nest HTTP process, isolated to the integration test's database schema.
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import dbConfig from '../mikro-orm.config';
import { LostPetsModule } from '../src/lost-pets/lost-pets.module';

const schema = process.env.QUEUE_TEST_SCHEMA!;
if (!/^queue_test_[a-z0-9]+$/.test(schema))
  throw new Error('Invalid test schema');

@Module({
  imports: [
    MikroOrmModule.forRoot({
      ...dbConfig,
      schema,
      debug: false,
      pool: {
        min: 0,
        max: 2,
        afterCreate: (
          connection: {
            query: (sql: string, cb: (error: Error | null) => void) => void;
          },
          done: (error: Error | null, connection: unknown) => void,
        ) =>
          connection.query(
            `set search_path to "${schema}", public, extensions`,
            (error) => done(error, connection),
          ),
      },
    }),
    LostPetsModule,
  ],
})
class QueueTestModule {}

async function main() {
  const app = await NestFactory.create(QueueTestModule, { logger: false });
  app.enableShutdownHooks();
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No HTTP port');
  process.send?.({ port: address.port });
}
void main();
