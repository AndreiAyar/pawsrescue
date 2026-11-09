import { defineConfig } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { config } from 'dotenv';

// Load environment variables from specific files
config({ path: '.env.development.local' });
config({ path: '.env.development' });
config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL?.trim();
const poolMax = Number.parseInt(process.env.DB_POOL_MAX || '10', 10);
const hasSeparateDatabaseConfig = [
  process.env.DB_HOST_NEST,
  process.env.DB_USER_NEST,
  process.env.DB_PASSWORD_NEST,
  process.env.DB_NAME_NEST,
].every((value) => Boolean(value?.trim()));
const sslEnabled = process.env.DB_SSL === 'true';
const sslRejectUnauthorized =
  process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

if (
  process.env.NODE_ENV === 'production' &&
  !databaseUrl &&
  !hasSeparateDatabaseConfig
) {
  throw new Error(
    'Configure DATABASE_URL or all DB_HOST_NEST, DB_USER_NEST, DB_PASSWORD_NEST, and DB_NAME_NEST values',
  );
}

const db_config = defineConfig({
  driver: PostgreSqlDriver,
  ...(databaseUrl
    ? { clientUrl: databaseUrl }
    : {
        host: process.env.DB_HOST_NEST || 'localhost',
        port: Number.parseInt(process.env.DB_PORT_NEST || '5432', 10),
        user: process.env.DB_USER_NEST || 'postgres',
        password: process.env.DB_PASSWORD_NEST || 'password',
        dbName: process.env.DB_NAME_NEST || 'mydb',
        ...(sslEnabled
          ? {
              driverOptions: {
                connection: {
                  ssl: {
                    rejectUnauthorized: sslRejectUnauthorized,
                  },
                },
              },
            }
          : {}),
      }),
  pool: {
    min: 0,
    max: Number.isFinite(poolMax) ? poolMax : 10,
  },
  schema: 'public',
  entities: ['dist/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],
  debug: process.env.NODE_ENV !== 'production',
  migrations: {
    path: 'dist/src/migrations',
    pathTs: 'src/migrations',
    tableName: 'mikro_orm_migrations',
  },
});

export default db_config;
