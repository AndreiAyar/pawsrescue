import { Migration } from '@mikro-orm/migrations';

export class Migration20250908195911 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "lost_pets" add column "country" varchar(255) null;`);
    this.addSql(`create index "lost_pets_country_index" on "lost_pets" ("country");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "lost_pets_country_index";`);
    this.addSql(`alter table "lost_pets" drop column "country";`);
  }

}
