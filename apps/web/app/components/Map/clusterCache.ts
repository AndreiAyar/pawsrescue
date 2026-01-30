import type * as maptilersdk from "@maptiler/sdk";
import type { Feature, FeatureCollection, Geometry } from "geojson";

type BBox = [number, number, number, number];
type BoundsResult = { bbox: BBox; bboxString: string };

export const createClusterCache = ({
  precision,
  paddingFactor,
  maxCoveragePerZoom,
  maxFeatureCount,
}: {
  precision: number;
  paddingFactor: number;
  maxCoveragePerZoom: number;
  maxFeatureCount: number;
}) => {
  const coverageByZoom = new Map<number, BBox[]>();
  const featuresByZoom = new Map<number, Map<string, Feature<Geometry>>>();
  const orderByZoom = new Map<number, string[]>();
  let maxFeatures = maxFeatureCount;

  const floorToPrecision = (value: number) =>
    Math.floor(value * precision) / precision;
  const ceilToPrecision = (value: number) =>
    Math.ceil(value * precision) / precision;
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const bboxContains = (outer: BBox, inner: BBox) =>
    outer[0] <= inner[0] &&
    outer[1] <= inner[1] &&
    outer[2] >= inner[2] &&
    outer[3] >= inner[3];
  const bboxOverlaps = (a: BBox, b: BBox) =>
    a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
  const mergeBbox = (a: BBox, b: BBox): BBox => [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
  const getFeatureCacheKey = (feature: Feature<Geometry>) => {
    const properties = feature.properties as
      | {
          id?: number | string;
          cluster?: boolean;
          cluster_id?: number | string;
          point_count?: number;
        }
      | null
      | undefined;
    const hasCluster = Boolean(properties?.cluster || properties?.point_count);
    if (hasCluster) {
      const clusterId = properties?.cluster_id;
      if (clusterId === undefined || clusterId === null) {
        return null;
      }
      return `c:${clusterId}`;
    }
    const featureId = properties?.id ?? feature.id;
    if (featureId === undefined || featureId === null) {
      return null;
    }
    return `p:${featureId}`;
  };

  const getBounds = (map: maptilersdk.Map | null): BoundsResult | null => {
    const bounds = map?.getBounds();
    if (!bounds) {
      return null;
    }
    const raw = bounds.toArray().flat();
    const width = raw[2] - raw[0];
    const height = raw[3] - raw[1];
    const padX = width * paddingFactor;
    const padY = height * paddingFactor;
    const padded: BBox = [
      floorToPrecision(clamp(raw[0] - padX, -180, 180)),
      floorToPrecision(clamp(raw[1] - padY, -90, 90)),
      ceilToPrecision(clamp(raw[2] + padX, -180, 180)),
      ceilToPrecision(clamp(raw[3] + padY, -90, 90)),
    ];
    const fallback: BBox = [
      floorToPrecision(clamp(raw[0], -180, 180)),
      floorToPrecision(clamp(raw[1], -90, 90)),
      ceilToPrecision(clamp(raw[2], -180, 180)),
      ceilToPrecision(clamp(raw[3], -90, 90)),
    ];
    const bbox =
      padded[0] < padded[2] && padded[1] < padded[3] ? padded : fallback;
    return { bbox, bboxString: bbox.join(",") };
  };

  const isCovered = (zoomLevel: number, bbox: BBox) => {
    const cached = coverageByZoom.get(zoomLevel);
    if (!cached || cached.length === 0) {
      return false;
    }
    return cached.some((entry) => bboxContains(entry, bbox));
  };

  const addCoverage = (zoomLevel: number, bbox: BBox) => {
    const list = coverageByZoom.get(zoomLevel) ?? [];
    let merged = bbox;
    let index = 0;
    while (index < list.length) {
      if (bboxOverlaps(list[index], merged)) {
        merged = mergeBbox(list[index], merged);
        list.splice(index, 1);
        index = 0;
        continue;
      }
      index += 1;
    }
    list.push(merged);
    if (list.length > maxCoveragePerZoom) {
      list.sort(
        (a, b) =>
          (b[2] - b[0]) * (b[3] - b[1]) -
          (a[2] - a[0]) * (a[3] - a[1])
      );
      list.length = maxCoveragePerZoom;
    }
    coverageByZoom.set(zoomLevel, list);
  };

  const upsertFeatures = (
    zoomLevel: number,
    features: Feature<Geometry>[]
  ) => {
    const featureMap = featuresByZoom.get(zoomLevel) ?? new Map();
    const featureOrder = orderByZoom.get(zoomLevel) ?? [];

    for (const feature of features) {
      if (!feature || feature.type !== "Feature") {
        continue;
      }
      const key = getFeatureCacheKey(feature);
      if (!key) {
        continue;
      }
      if (!featureMap.has(key)) {
        featureOrder.push(key);
      }
      featureMap.set(key, feature);
    }

    while (featureOrder.length > maxFeatures) {
      const oldest = featureOrder.shift();
      if (oldest) {
        featureMap.delete(oldest);
      }
    }

    featuresByZoom.set(zoomLevel, featureMap);
    orderByZoom.set(zoomLevel, featureOrder);

    return {
      type: "FeatureCollection",
      features: Array.from(featureMap.values()),
    } satisfies FeatureCollection<Geometry>;
  };

  const applyToSource = (
    zoomLevel: number,
    source: maptilersdk.GeoJSONSource
  ) => {
    const featureMap = featuresByZoom.get(zoomLevel);
    if (!featureMap || featureMap.size === 0) {
      return false;
    }
    source.setData({
      type: "FeatureCollection",
      features: Array.from(featureMap.values()),
    });
    return true;
  };

  const setMaxFeatureCount = (nextMax: number) => {
    maxFeatures = nextMax;
  };

  return {
    getBounds,
    isCovered,
    addCoverage,
    upsertFeatures,
    applyToSource,
    setMaxFeatureCount,
  };
};
