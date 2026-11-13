import { copyFile } from "node:fs/promises";
import { constants } from "node:fs";

const root = new URL("../", import.meta.url);
const files = [
  [".env.example", ".env"],
  ["apps/api/.env.example", "apps/api/.env.development.local"],
  ["apps/web/.env.example", "apps/web/.env.local"],
  ["apps/ai/.env.example", "apps/ai/.env.local"],
];

for (const [source, target] of files) {
  try {
    await copyFile(
      new URL(source, root),
      new URL(target, root),
      constants.COPYFILE_EXCL,
    );
    console.log(`Created ${target}`);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log(`Kept existing ${target}`);
  }
}
console.log(
  "Set your MapTiler key in .env (Docker) or apps/web/.env.local (native).",
);
console.log(
  "These defaults use a local development database; review before running.",
);
