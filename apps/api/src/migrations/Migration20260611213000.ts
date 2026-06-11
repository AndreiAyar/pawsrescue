import { Migration } from '@mikro-orm/migrations';

export class Migration20260611213000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`update "lost_pets" set "embedding" = null where "embedding" is not null;`);
    this.addSql(
      `alter table "lost_pets" alter column "embedding" type vector(1024) using null::vector(1024);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`update "lost_pets" set "embedding" = null where "embedding" is not null;`);
    this.addSql(
      `alter table "lost_pets" alter column "embedding" type vector(768) using null::vector(768);`,
    );
  }
}
