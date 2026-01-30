/**
 * GeoJSON types for lost pets clustering functionality
 */

export interface Point {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface PetProperties {
  id: number;
  name: string;
  type: 'cat' | 'dog' | 'bird';
  status: 'lost' | 'found';
}

export interface ClusterProperties {
  cluster: boolean;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string;
  expansion_zoom?: number;
}

export interface Feature<T = any> {
  type: 'Feature';
  properties: T;
  geometry: Point;
}

export interface FeatureCollection<T = any, M = unknown> {
  type: 'FeatureCollection';
  features: Feature<T>[];
  meta?: M;
}

export type PetFeature = Feature<PetProperties>;

export type ClusterFeature = Feature<ClusterProperties>;

export type ClusteringFeature = PetFeature | ClusterFeature;

export type ClusteringResult = FeatureCollection<
  PetProperties | ClusterProperties,
  {
    count: number;
    zoom: number;
    bbox: BoundingBox;
  }
>;

export type BoundingBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
