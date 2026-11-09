import { Migration } from '@mikro-orm/migrations';

export class Migration20260611113000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "lost_pets" add column "embedding_model" varchar(255) null;`,
    );
    this.addSql(
      `alter table "lost_pets" add column "embedding_fallback_used" boolean null;`,
    );
    this.addSql(
      `alter table "lost_pets" add column "embedding_warning" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "lost_pets" drop column "embedding_model";`);
    this.addSql(
      `alter table "lost_pets" drop column "embedding_fallback_used";`,
    );
    this.addSql(`alter table "lost_pets" drop column "embedding_warning";`);
  }
}
