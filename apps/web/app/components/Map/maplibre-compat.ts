// MapTiler SDK 3 expects MapLibre's former default namespace export.
// Keep the patched MapLibre 6 renderer and adapt only that import shape.
import * as maplibre from "maplibre-gl/dist/maplibre-gl.mjs";
maplibre.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

export * from "maplibre-gl/dist/maplibre-gl.mjs";
export default maplibre;
