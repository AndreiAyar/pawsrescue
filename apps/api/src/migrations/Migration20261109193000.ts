import { Migration } from '@mikro-orm/migrations';

export class Migration20261109193000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "lost_pets" add column "embedding_status" varchar(20) not null default 'none';`,
    );
    this.addSql(`update "lost_pets" set "embedding_status" = case
      when "embedding" is not null and coalesce("embedding_fallback_used", false) = false then 'ready'
      when jsonb_array_length(coalesce("image_urls", '[]'::jsonb)) > 0 then 'pending'
      else 'none' end;`);
    this.addSql(
      `create index "lost_pets_embedding_pending" on "lost_pets" ("id") where "embedding_status" in ('pending', 'processing');`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "lost_pets_embedding_pending";`);
    this.addSql(`alter table "lost_pets" drop column "embedding_status";`);
  }
}
