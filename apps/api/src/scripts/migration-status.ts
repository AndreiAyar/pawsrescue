import { MikroORM } from '@mikro-orm/postgresql';
import config from '../../mikro-orm.config';

async function main() {
  const orm = await MikroORM.init(config);
  try {
    const migrator = orm.getMigrator();
    console.log(
      JSON.stringify(
        {
          executed: await migrator.getExecutedMigrations(),
          pending: await migrator.getPendingMigrations(),
        },
        null,
        2,
      ),
    );
  } finally {
    await orm.close(true);
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Could not inspect migrations',
  );
  process.exitCode = 1;
});
