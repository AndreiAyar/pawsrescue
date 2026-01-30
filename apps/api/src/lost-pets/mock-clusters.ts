//@ts-nocheck
import Supercluster from 'supercluster';
import { ClusteringResult, PetFeature } from './types';

const MOCK_COUNT = 200000;
const DEFAULT_BBOX: [number, number, number, number] = [
  20.0, 43.0, 30.0, 48.5,
];
const DEFAULT_SEED = 1337;

let mockCluster: Supercluster<PetFeature['properties']> | null = null;

const createSeededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const buildMockCluster = () => {
  const random = createSeededRandom(DEFAULT_SEED);
  const [minLng, minLat, maxLng, maxLat] = DEFAULT_BBOX;
  const points: PetFeature[] = Array.from({ length: MOCK_COUNT }, (_, i) => {
    const lng = minLng + random() * (maxLng - minLng);
    const lat = minLat + random() * (maxLat - minLat);
    return {
      type: 'Feature',
      properties: {
        id: i + 1,
        name: `Mock Pet ${i + 1}`,
        type: i % 2 === 0 ? 'dog' : 'cat',
        status: 'lost',
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
    };
  });

  const cluster = new Supercluster({
    radius: 60,
    maxZoom: 18,
  });
  cluster.load(points);
  return cluster;
};

export const getMockClusters = (
  bbox: [number, number, number, number],
  zoom: number,
): ClusteringResult => {
  if (!mockCluster) {
    mockCluster = buildMockCluster();
  }

  const clusters = mockCluster.getClusters(bbox, zoom);
  const features = clusters.map((feature) => {
    const properties = feature.properties as
      | {
          cluster?: boolean;
          cluster_id?: number;
        }
      | undefined;
    if (properties?.cluster && typeof properties.cluster_id === 'number') {
      return {
        ...feature,
        properties: {
          ...feature.properties,
          expansion_zoom: mockCluster.getClusterExpansionZoom(
            properties.cluster_id,
          ),
        },
      };
    }
    return feature;
  });
  return {
    type: 'FeatureCollection',
    features: features as ClusteringResult['features'],
    meta: {
      count: features.length,
      zoom,
      bbox,
    },
  };
};
