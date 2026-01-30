export type TileBbox = [number, number, number, number];

const MAX_LATITUDE = 85.05112878;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const tileToLng = (tileX: number, zoom: number) => {
  const scale = Math.pow(2, zoom);
  return (tileX / scale) * 360 - 180;
};

const tileToLat = (tileY: number, zoom: number) => {
  const scale = Math.pow(2, zoom);
  const n = Math.PI - (2 * Math.PI * tileY) / scale;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

export const tileToBbox = ({
  z,
  x,
  y,
  buffer = 0,
}: {
  z: number;
  x: number;
  y: number;
  buffer?: number;
}): TileBbox => {
  const scale = Math.pow(2, z);
  const maxIndex = scale - 1;
  const safeBuffer = Math.max(0, Math.floor(buffer));
  const clampIndex = (value: number) => clamp(value, 0, maxIndex);
  const clampEdge = (value: number) => clamp(value, 0, scale);

  const minTileX = clampIndex(x - safeBuffer);
  const maxTileX = clampIndex(x + safeBuffer);
  const minTileY = clampIndex(y - safeBuffer);
  const maxTileY = clampIndex(y + safeBuffer);

  const west = tileToLng(clampEdge(minTileX), z);
  const east = tileToLng(clampEdge(maxTileX + 1), z);
  const north = tileToLat(clampEdge(minTileY), z);
  const south = tileToLat(clampEdge(maxTileY + 1), z);

  const minLng = Math.min(west, east);
  const maxLng = Math.max(west, east);
  const minLat = clamp(Math.min(south, north), -MAX_LATITUDE, MAX_LATITUDE);
  const maxLat = clamp(Math.max(south, north), -MAX_LATITUDE, MAX_LATITUDE);

  return [minLng, minLat, maxLng, maxLat];
};
