import { Migration } from '@mikro-orm/migrations';

export class Migration20251110183926 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "lost_pets" add column "email" varchar(255) null;`,
    );
    this.addSql(
      `alter table "lost_pets" rename column "neighborhood" to "phone";`,
    );
    this.addSql(
      `create index "lost_pets_email_index" on "lost_pets" ("email");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "lost_pets_email_index";`);
    this.addSql(`alter table "lost_pets" drop column "email";`);

    this.addSql(
      `alter table "lost_pets" rename column "phone" to "neighborhood";`,
    );
  }
}
