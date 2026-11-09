import { Migration } from '@mikro-orm/migrations';

/** Restore the original schema needed by the historical migrations. */
export class Migration20250901000000 extends Migration {
  override async up(): Promise<void> {
    // Existing installations already have this table. Never replace their data.
    this.addSql(`create table if not exists "lost_pets" (
      "id" serial primary key,
      "name" varchar(255) not null,
      "city" varchar(255) null,
      "location" varchar(255) not null,
      "lat" integer null,
      "lon" integer null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now()
    );`);
  }

  override async down(): Promise<void> {
    throw new Error(
      'The baseline is irreversible. Restore a backup to reset the database.',
    );
  }
}
