type BBox = [number, number, number, number];

const MAX_LATITUDE = 85.05112878;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampLng = (lng: number) => clamp(lng, -180, 180);
const clampLat = (lat: number) => clamp(lat, -MAX_LATITUDE, MAX_LATITUDE);

const lngToTileX = (lng: number, zoom: number) => {
  const scale = Math.pow(2, zoom);
  const normalized = (clampLng(lng) + 180) / 360;
  return clamp(Math.floor(normalized * scale), 0, scale - 1);
};

const latToTileY = (lat: number, zoom: number) => {
  const scale = Math.pow(2, zoom);
  const latRad = (clampLat(lat) * Math.PI) / 180;
  const normalized =
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  return clamp(Math.floor(normalized * scale), 0, scale - 1);
};

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
}): BBox => {
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

export const getTileRequestForBounds = (bbox: BBox, zoom: number) => {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const minX = lngToTileX(minLng, zoom);
  const maxX = lngToTileX(maxLng, zoom);
  const minY = latToTileY(maxLat, zoom);
  const maxY = latToTileY(minLat, zoom);

  const centerX = Math.floor((minX + maxX) / 2);
  const centerY = Math.floor((minY + maxY) / 2);
  const bufferX = Math.ceil((maxX - minX) / 2);
  const bufferY = Math.ceil((maxY - minY) / 2);
  const buffer = Math.max(1, bufferX, bufferY);

  const tileBbox = tileToBbox({
    z: zoom,
    x: centerX,
    y: centerY,
    buffer,
  });

  return {
    x: centerX,
    y: centerY,
    z: zoom,
    buffer,
    bbox: tileBbox,
    key: `${zoom}/${centerX}/${centerY}/b${buffer}`,
  };
};
