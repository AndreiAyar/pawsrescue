import { defineConfig } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { config } from 'dotenv';

// Load environment variables from specific files
config({ path: '.env.development.local' });
config({ path: '.env.development' });
config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL?.trim();
const poolMax = Number.parseInt(process.env.DB_POOL_MAX || '10', 10);

if (process.env.NODE_ENV === 'production' && !databaseUrl) {
  throw new Error('DATABASE_URL is required in production');
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
