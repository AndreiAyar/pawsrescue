import { Migration } from '@mikro-orm/migrations';

export class Migration20260611101500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `update "lost_pets" set "embedding" = null where "embedding" is not null;`,
    );
    this.addSql(
      `alter table "lost_pets" alter column "embedding" type vector(768) using null::vector(768);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `update "lost_pets" set "embedding" = null where "embedding" is not null;`,
    );
    this.addSql(
      `alter table "lost_pets" alter column "embedding" type vector(3) using null::vector(3);`,
    );
  }
}
