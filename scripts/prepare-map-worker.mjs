import { copyFile, mkdir } from "node:fs/promises";

// MapLibre 6 ships ES-module workers. Keep their relative imports together and
// serve them from our own origin in both development and the standalone image.
const target = new URL("../apps/web/public/vendor/maplibre/", import.meta.url);
const source = new URL("../node_modules/maplibre-gl/dist/", import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(new URL(file, source), new URL(file, target));
}

await copyFile(
  new URL("../node_modules/maplibre-gl/LICENSE.txt", import.meta.url),
  new URL("LICENSE.txt", target),
);
