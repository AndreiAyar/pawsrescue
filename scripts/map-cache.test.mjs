import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = fs.readFileSync(
  new URL("../apps/web/app/components/Map/clusterCache.ts", import.meta.url),
  "utf8",
);
const box = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  box,
);
const makeCache = () =>
  box.exports.createClusterCache({
    precision: 1e5,
    paddingFactor: 0.2,
    maxCoveragePerZoom: 64,
    maxFeatureCount: 1000,
  });
const cluster = (x) => ({
  type: "Feature",
  properties: { cluster: true, cluster_id: 22, point_count: 3 },
  geometry: { type: "Point", coordinates: [x, 45] },
});
test("coverage does not invent a loaded corner between overlapping rectangles", () => {
  const c = makeCache();
  c.addCoverage(10, [0, 0, 2, 1]);
  c.addCoverage(10, [1, 0, 2, 2]);
  assert.equal(c.isCovered(10, [0.1, 1.1, 0.9, 1.9]), false);
  assert.equal(c.isCovered(10, [0.1, 0.1, 0.9, 0.9]), true);
});
test("regional responses replace stale clusters and invalidate old coverage", () => {
  const c = makeCache();
  c.upsertFeatures(10, [cluster(0)]);
  c.addCoverage(10, [0, 0, 1, 1]);
  const next = c.upsertFeatures(10, [cluster(20)]);
  c.addCoverage(10, [20, 0, 21, 1]);
  assert.equal(next.features.length, 1);
  assert.equal(next.features[0].geometry.coordinates[0], 20);
  assert.equal(c.isCovered(10, [0, 0, 1, 1]), false);
});
test("an empty response clears stale map features", () => {
  const c = makeCache();
  c.upsertFeatures(10, [cluster(0)]);
  assert.equal(c.upsertFeatures(10, []).features.length, 0);
});
