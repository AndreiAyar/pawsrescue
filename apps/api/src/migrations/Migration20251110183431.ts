import { Migration } from '@mikro-orm/migrations';

export class Migration20251110183431 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "lost_pets" drop column "location";`);

    this.addSql(
      `alter table "lost_pets" add column "description" text null, add column "type" varchar(255) null, add column "image_urls" jsonb null, add column "raw_location" varchar(255) null, add column "street_address" varchar(255) null, add column "region" varchar(255) null, add column "postal_code" varchar(255) null, add column "neighborhood" varchar(255) null, add column "formatted_address" varchar(255) null, add column "place_name" varchar(255) null, add column "location_accuracy" int null, add column "location_source" varchar(255) null, add column "map_tiler_data" jsonb null;`,
    );
    this.addSql(`create index "lost_pets_city_index" on "lost_pets" ("city");`);
    this.addSql(
      `create index "lost_pets_region_index" on "lost_pets" ("region");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "lost_pets_city_index";`);
    this.addSql(`drop index "lost_pets_region_index";`);
    this.addSql(
      `alter table "lost_pets" drop column "description", drop column "type", drop column "image_urls", drop column "raw_location", drop column "street_address", drop column "region", drop column "postal_code", drop column "neighborhood", drop column "formatted_address", drop column "place_name", drop column "location_accuracy", drop column "location_source", drop column "map_tiler_data";`,
    );

    this.addSql(
      `alter table "lost_pets" add column "location" varchar(255) not null;`,
    );
  }
}
