import { defineConfig } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { config } from 'dotenv';

// Load environment variables from specific files
config({ path: '.env.development.local' });
config({ path: '.env.development' });
config({ path: '.env' });

const db_config = defineConfig({
  driver: PostgreSqlDriver,
  host: process.env.DB_HOST_NEST || 'localhost',
  port: parseInt(process.env.DB_PORT_NEST || '5432'),
  user: process.env.DB_USER_NEST || 'postgres',
  password: process.env.DB_PASSWORD_NEST || 'password',
  dbName: process.env.DB_NAME_NEST || 'mydb',
  schema: 'public',
  entities: ['dist/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],
  debug: process.env.NODE_ENV !== 'production',
  migrations: {
    path: 'dist/migrations',
    pathTs: 'src/migrations',
    tableName: 'mikro_orm_migrations',
  },
});

export default db_config;
