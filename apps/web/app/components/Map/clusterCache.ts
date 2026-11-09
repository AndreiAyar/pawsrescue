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
      return `c:${clusterId}:${JSON.stringify(feature.geometry)}`;
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
    const coordinates = bounds.toArray();
    const southwest = coordinates[0];
    const northeast = coordinates[1];
    if (!southwest || !northeast) {
      return null;
    }
    const [west, south] = southwest;
    const [east, north] = northeast;
    const width = east - west;
    const height = north - south;
    const padX = width * paddingFactor;
    const padY = height * paddingFactor;
    const padded: BBox = [
      floorToPrecision(clamp(west - padX, -180, 180)),
      floorToPrecision(clamp(south - padY, -90, 90)),
      ceilToPrecision(clamp(east + padX, -180, 180)),
      ceilToPrecision(clamp(north + padY, -90, 90)),
    ];
    const fallback: BBox = [
      floorToPrecision(clamp(west, -180, 180)),
      floorToPrecision(clamp(south, -90, 90)),
      ceilToPrecision(clamp(east, -180, 180)),
      ceilToPrecision(clamp(north, -90, 90)),
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
    // Only union rectangles when containment makes their union rectangular.
    // A bounding box around an L-shaped union would mark unvisited space loaded.
    if (list.some((entry) => bboxContains(entry, bbox))) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const entry = list[i];
      if (entry && bboxContains(bbox, entry)) list.splice(i, 1);
    }
    list.push(bbox);
    if (list.length > maxCoveragePerZoom) {
      list.sort(
        (a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]),
      );
      list.length = maxCoveragePerZoom;
    }
    coverageByZoom.set(zoomLevel, list);
  };

  const upsertFeatures = (zoomLevel: number, features: Feature<Geometry>[]) => {
    const featureMap = new Map<string, Feature<Geometry>>();
    const featureOrder: string[] = [];
    coverageByZoom.delete(zoomLevel);

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
    source: maptilersdk.GeoJSONSource,
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
