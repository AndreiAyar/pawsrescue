import { Migration } from '@mikro-orm/migrations';

export class Migration20250908194822 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "lost_pets" drop column "lat", drop column "lon";`);

    this.addSql(`alter table "lost_pets" add column "latitude" numeric(10,8) null, add column "longitude" numeric(11,8) null;`);
    this.addSql(`create index "lost_pets_latitude_index" on "lost_pets" ("latitude");`);
    this.addSql(`create index "lost_pets_longitude_index" on "lost_pets" ("longitude");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "lost_pets_latitude_index";`);
    this.addSql(`drop index "lost_pets_longitude_index";`);
    this.addSql(`alter table "lost_pets" drop column "latitude", drop column "longitude";`);

    this.addSql(`alter table "lost_pets" add column "lat" int null, add column "lon" int null;`);
  }

}
