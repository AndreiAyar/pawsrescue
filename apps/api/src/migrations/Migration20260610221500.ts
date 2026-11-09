import { Migration } from '@mikro-orm/migrations';

export class Migration20260610221500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create extension if not exists vector;`);
    this.addSql(
      `alter table "lost_pets" add column "embedding" vector(3) null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "lost_pets" drop column "embedding";`);
  }
}
