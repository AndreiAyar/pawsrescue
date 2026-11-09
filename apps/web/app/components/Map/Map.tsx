"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@repo/ui/button";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import * as maptilersdk from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { GeocodingControl } from "@maptiler/geocoding-control/react";
import { createMapLibreGlMapController } from "@maptiler/geocoding-control/maplibregl-controller";
import "@maptiler/geocoding-control/style.css";
import { createClusterCache } from "./clusterCache";
import { getTileRequestForBounds } from "./clusterTiles";
const apiBase = "/api";
const BBOX_PRECISION = 1e5;
const BBOX_PADDING_FACTOR = 0.2;
const MAX_CACHED_COVERAGE_PER_ZOOM = 64;
const CLUSTER_REFRESH_DEBOUNCE_MS = 300;

type MapProps = {
  className?: string;
  onLocationChange?: (location: {
    street?: string;
    city?: string;
    label: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  locateLabel?: string;
  locatingLabel?: string;
  locateRequestId?: number;
  manualLocateRequestId?: number;
  clustersRequestId?: number;
  onLocateRequest?: () => void;
  onLocateError?: (error: GeolocationPositionError) => void;
  showLocateButton?: boolean;
  showSearchControl?: boolean;
  enableCenterMarker?: boolean;
  maxReverseGeocodeRequests?: number;
  persistClusterFeatures?: boolean;
  maxPersistedClusterFeatures?: number;
  useTileClusters?: boolean;
  listingHrefBase?: string | null;
  openListingLabel?: string;
  focusLocation?: {
    latitude: number;
    longitude: number;
    label?: string;
  } | null;
};

type GeoJSONData = FeatureCollection<Geometry> | Feature<Geometry> | Geometry;

export default function MapView({
  className = "",
  onLocationChange,
  locateLabel = "Locate me",
  locatingLabel = "Locating...",
  locateRequestId,
  manualLocateRequestId,
  clustersRequestId,
  onLocateRequest,
  onLocateError,
  showLocateButton = true,
  showSearchControl = true,
  enableCenterMarker = false,
  maxReverseGeocodeRequests = 25,
  persistClusterFeatures = false,
  maxPersistedClusterFeatures = 10000,
  useTileClusters = false,
  listingHrefBase = null,
  openListingLabel = "Open listing",
  focusLocation = null,
}: MapProps) {
  const [mapController, setMapController] = useState<
    ReturnType<typeof createMapLibreGlMapController> | undefined
  >(undefined);
  const [currentPosition, setCurrentPosition] = useState({ lng: 0, lat: 0 });
  const [locating, setLocating] = useState(false);
  const focusLatitude = focusLocation?.latitude;
  const focusLongitude = focusLocation?.longitude;

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<maptilersdk.Marker | null>(null);
  const userMarkerRef = useRef<maptilersdk.Marker | null>(null);
  const focusMarkerRef = useRef<maptilersdk.Marker | null>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const intialPosRef = useRef({ lang: 26.102, lat: 44.435 });
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const geocodeRequestCountRef = useRef(0);
  const sourcesReadyRef = useRef(false);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clusterRequestIdRef = useRef(0);
  const pendingClusterRefreshRef = useRef(false);
  const skipNextMoveendRef = useRef(false);
  const inFlightRequestKeyRef = useRef<string | null>(null);
  const cacheRef = useRef(
    createClusterCache({
      precision: BBOX_PRECISION,
      paddingFactor: BBOX_PADDING_FACTOR,
      maxCoveragePerZoom: MAX_CACHED_COVERAGE_PER_ZOOM,
      maxFeatureCount: maxPersistedClusterFeatures,
    }),
  );

  useEffect(() => {
    cacheRef.current.setMaxFeatureCount(maxPersistedClusterFeatures);
  }, [maxPersistedClusterFeatures]);

  const zoom = useMemo(() => 5, []);
  maptilersdk.config.apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || "";

  const updatePosition = (lng: number, lat: number) => {
    if (!enableCenterMarker) {
      return;
    }
    markerRef.current?.setLngLat([lng, lat]);
    setCurrentPosition({ lng, lat });
  };

  const makeClustersUrl = (bbox: string, zoomLevel: number) => {
    const normalizedZoom = Math.max(0, Math.floor(zoomLevel));
    return `${apiBase}/lost-pets/clusters?bbox=${bbox}&zoom=${normalizedZoom}`;
  };

  const makeTileClustersUrl = (
    zoomLevel: number,
    x: number,
    y: number,
    buffer: number,
  ) => {
    const normalizedZoom = Math.max(0, Math.floor(zoomLevel));
    const bufferParam = buffer > 1 ? `?buffer=${buffer}` : "";
    return `${apiBase}/lost-pets/clusters/tile/${normalizedZoom}/${x}/${y}${bufferParam}`;
  };

  const refreshClusters = async (zoomLevel?: number) => {
    if (!map.current) {
      return;
    }
    if (!sourcesReadyRef.current) {
      pendingClusterRefreshRef.current = true;
      return;
    }
    const requestId = ++clusterRequestIdRef.current;
    const zoomValue = zoomLevel ?? map.current.getZoom() ?? 0;
    const bounds = cacheRef.current.getBounds(map.current);
    if (!bounds) {
      return;
    }
    const { bbox, bboxString } = bounds;
    const normalizedZoom = Math.max(0, Math.floor(zoomValue));
    const tileRequest = useTileClusters
      ? getTileRequestForBounds(bbox, normalizedZoom)
      : null;
    const coverageBbox = tileRequest?.bbox ?? bbox;
    if (
      persistClusterFeatures &&
      cacheRef.current.isCovered(normalizedZoom, coverageBbox)
    ) {
      const source = map.current.getSource("lostPetsJson") as
        | maptilersdk.GeoJSONSource
        | undefined;
      if (source) {
        cacheRef.current.applyToSource(normalizedZoom, source);
      }
      return;
    }
    const requestKey = tileRequest
      ? `tile:${tileRequest.key}`
      : `bbox:${bboxString}:${normalizedZoom}`;
    if (inFlightRequestKeyRef.current === requestKey) {
      return;
    }
    inFlightRequestKeyRef.current = requestKey;
    try {
      const clustersUrl = tileRequest
        ? makeTileClustersUrl(
            tileRequest.z,
            tileRequest.x,
            tileRequest.y,
            tileRequest.buffer,
          )
        : makeClustersUrl(bboxString, normalizedZoom);
      if (!clustersUrl) {
        return;
      }
      const res = await fetch(clustersUrl);
      if (!res.ok) {
        return;
      }
      const text = await res.text();
      if (!text) {
        return;
      }
      let geojson: unknown;
      try {
        geojson = JSON.parse(text);
      } catch {
        return;
      }
      if (requestId !== clusterRequestIdRef.current) {
        return;
      }
      const source = map.current.getSource("lostPetsJson") as
        | maptilersdk.GeoJSONSource
        | undefined;
      if (!source) {
        return;
      }

      const incoming = geojson as GeoJSONData;
      if (persistClusterFeatures) {
        cacheRef.current.addCoverage(normalizedZoom, coverageBbox);
      }
      if (
        persistClusterFeatures &&
        incoming.type === "FeatureCollection" &&
        Array.isArray(incoming.features)
      ) {
        source.setData(
          cacheRef.current.upsertFeatures(normalizedZoom, incoming.features),
        );
        return;
      }

      source.setData(incoming);
    } finally {
      if (inFlightRequestKeyRef.current === requestKey) {
        inFlightRequestKeyRef.current = null;
      }
    }
  };

  const triggerReverseGeocode = (lng: number, lat: number) => {
    if (!onLocationChange || !maptilersdk.config.apiKey) {
      return;
    }
    if (maxReverseGeocodeRequests <= 0) {
      return;
    }
    if (geocodeRequestCountRef.current >= maxReverseGeocodeRequests) {
      return;
    }

    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    geocodeTimeoutRef.current = setTimeout(async () => {
      if (geocodeAbortRef.current) {
        geocodeAbortRef.current.abort();
      }

      const controller = new AbortController();
      geocodeAbortRef.current = controller;
      geocodeRequestCountRef.current += 1;

      try {
        const res = await fetch(
          `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${maptilersdk.config.apiKey}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          features?: Array<{
            place_type?: string[];
            text?: string;
            place_name?: string;
          }>;
        };

        const features = data.features ?? [];
        const address = features.find((feature) =>
          feature.place_type?.includes("address"),
        );
        const place = features.find((feature) =>
          feature.place_type?.some((type) =>
            ["place", "locality", "municipality"].includes(type),
          ),
        );

        const street =
          address?.text ?? address?.place_name?.split(",")[0]?.trim();
        const city = place?.text;
        const label =
          [street, city].filter(Boolean).join(", ") ||
          features[0]?.place_name ||
          "";

        onLocationChange({
          street,
          city,
          label,
          latitude: lat,
          longitude: lng,
        });
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") {
          return;
        }
      }
    }, 350);
  };

  useEffect(() => {
    if (map.current) return; // stops map from intializing more than once
    if (!mapContainer.current) return; // ensure container is available

    const initialPos = intialPosRef?.current;
    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: maptilersdk.MapStyle.STREETS,
      center: [initialPos.lang, initialPos.lat],
      zoom: zoom,
    });

    const controller = createMapLibreGlMapController(map.current, maptilersdk);
    setMapController(controller);

    if (enableCenterMarker) {
      const marker = new maptilersdk.Marker({
        color: "red",
      })
        .setLngLat([initialPos.lang, initialPos.lat])
        .addTo(map.current);
      markerRef.current = marker;
    }

    // Move marker when map is clicked
    if (map.current) {
      map.current.on("move", () => {
        if (!enableCenterMarker) {
          return;
        }
        const lngLat = map.current?.getCenter();
        if (!lngLat) {
          return;
        }
        updatePosition(lngLat.lng, lngLat.lat);
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        focusMarkerRef.current = null;
      }
    };
  }, [intialPosRef?.current?.lang, intialPosRef?.current?.lat]);

  useEffect(() => {
    if (
      !map.current ||
      typeof focusLatitude !== "number" ||
      typeof focusLongitude !== "number" ||
      !Number.isFinite(focusLatitude) ||
      !Number.isFinite(focusLongitude)
    ) {
      focusMarkerRef.current?.remove();
      focusMarkerRef.current = null;
      return;
    }

    const coordinates: [number, number] = [focusLongitude, focusLatitude];

    if (!focusMarkerRef.current) {
      const markerElement = document.createElement("div");
      markerElement.style.width = "24px";
      markerElement.style.height = "24px";
      markerElement.style.borderRadius = "999px";
      markerElement.style.background = "#f59e0b";
      markerElement.style.border = "4px solid #ffffff";
      markerElement.style.boxShadow =
        "0 0 0 6px rgba(245,158,11,0.28), 0 12px 24px -10px rgba(15,23,42,0.65)";

      focusMarkerRef.current = new maptilersdk.Marker({
        element: markerElement,
      })
        .setLngLat(coordinates)
        .addTo(map.current);
    } else {
      focusMarkerRef.current.setLngLat(coordinates);
    }

    map.current.easeTo({ center: coordinates, zoom: 14, duration: 700 });
  }, [focusLatitude, focusLongitude]);

  useEffect(() => {
    if (!map.current) {
      return;
    }

    const setupSources = () => {
      if (!map.current || sourcesReadyRef.current) {
        return;
      }
      if (map.current.getSource("lostPetsJson")) {
        sourcesReadyRef.current = true;
        return;
      }

      map.current.addSource("lostPetsJson", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.current.addLayer({
        id: "clusters",
        type: "circle",
        source: "lostPetsJson",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#51bbd6",
            100,
            "#f1f075",
            750,
            "#f28cb1",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20,
            100,
            30,
            750,
            40,
          ],
        },
      });

      map.current.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "lostPetsJson",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
      });

      const addEmojiIcon = (id: string, emoji: string, bg: string) => {
        if (!map.current || map.current.hasImage(id)) {
          return;
        }
        const size = 48;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }

        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#f59e0b";
        ctx.stroke();

        ctx.font = "22px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji, size / 2, size / 2 + 1);

        const image = new Image();
        image.src = canvas.toDataURL();
        image.onload = () => {
          if (!map.current || map.current.hasImage(id)) {
            return;
          }
          map.current.addImage(id, image);
        };
      };

      const addLabelPill = (id: string) => {
        if (!map.current || map.current.hasImage(id)) {
          return;
        }
        const width = 140;
        const height = 36;
        const radius = 16;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }

        ctx.fillStyle = "#fffaf5";
        ctx.strokeStyle = "#f1e5d3";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(width - radius, 0);
        ctx.quadraticCurveTo(width, 0, width, radius);
        ctx.lineTo(width, height - radius);
        ctx.quadraticCurveTo(width, height, width - radius, height);
        ctx.lineTo(radius, height);
        ctx.quadraticCurveTo(0, height, 0, height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const image = new Image();
        image.src = canvas.toDataURL();
        image.onload = () => {
          if (!map.current || map.current.hasImage(id)) {
            return;
          }
          map.current.addImage(id, image);
        };
      };

      const addRingImage = (id: string) => {
        if (!map.current || map.current.hasImage(id)) {
          return;
        }
        const size = 72;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }
        const center = size / 2;
        const radius = size / 2 - 6;

        ctx.clearRect(0, 0, size, size);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
        ctx.beginPath();
        ctx.arc(center, center, radius, Math.PI * 0.1, Math.PI * 0.5);
        ctx.stroke();

        ctx.strokeStyle = "rgba(245, 158, 11, 0.65)";
        ctx.beginPath();
        ctx.arc(center, center, radius, Math.PI * 1.0, Math.PI * 1.25);
        ctx.stroke();

        ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
        ctx.beginPath();
        ctx.arc(center, center, radius, Math.PI * 1.55, Math.PI * 1.75);
        ctx.stroke();

        const image = new Image();
        image.src = canvas.toDataURL();
        image.onload = () => {
          if (!map.current || map.current.hasImage(id)) {
            return;
          }
          map.current.addImage(id, image);
        };
      };

      addEmojiIcon("pet-cat", "🐱", "#fef3c7");
      addEmojiIcon("pet-dog", "🐶", "#fde2e2");
      addEmojiIcon("pet-bird", "🐦", "#e0f2fe");
      addEmojiIcon("pet-default", "🐾", "#fef9c3");
      addLabelPill("pet-label-pill");
      addRingImage("pet-ring");

      map.current.addLayer({
        id: "unclustered-ring",
        type: "symbol",
        source: "lostPetsJson",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": "pet-ring",
          "icon-size": 0.9,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-rotate": 0,
        },
      });

      map.current.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "lostPetsJson",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#fff7ed",
          "circle-radius": 18,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#f59e0b",
        },
      });

      map.current.addLayer({
        id: "unclustered-avatar",
        type: "symbol",
        source: "lostPetsJson",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": [
            "match",
            ["get", "type"],
            "cat",
            "pet-cat",
            "dog",
            "pet-dog",
            "bird",
            "pet-bird",
            "pet-default",
          ],
          "icon-size": 0.85,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      map.current.addLayer({
        id: "unclustered-label",
        type: "symbol",
        source: "lostPetsJson",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": "pet-label-pill",
          "icon-text-fit": "both",
          "icon-text-fit-padding": [6, 12, 6, 12],
          "icon-allow-overlap": false,
          "icon-anchor": "top",
          "icon-offset": [0, 2.0],
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-offset": [0, 2.0],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "icon-opacity": 0.82,
          "text-color": "#1f2937",
          "text-halo-color": "#ffffff",
          "text-halo-width": 0.5,
        },
      });

      map.current.on("click", "clusters", (event) => {
        if (!map.current) {
          return;
        }
        const features = map.current.queryRenderedFeatures(event.point, {
          layers: ["clusters"],
        });
        const clusterFeature = features[0];
        if (!clusterFeature || clusterFeature.geometry.type !== "Point") {
          return;
        }
        const clusterProps = clusterFeature.properties ?? {};
        const expansionZoomRaw = (clusterProps as { expansion_zoom?: number })
          .expansion_zoom;
        const currentZoom = map.current.getZoom();
        const targetZoom =
          typeof expansionZoomRaw === "number"
            ? expansionZoomRaw
            : currentZoom + 2;
        const nextZoom = Math.min(
          Math.max(targetZoom, currentZoom + 1),
          map.current.getMaxZoom(),
        );
        const coords = (clusterFeature.geometry as Point).coordinates as [
          number,
          number,
        ];
        map.current.easeTo({
          center: coords,
          zoom: nextZoom,
        });
      });

      const handlePetClick = (event: maptilersdk.MapLayerMouseEvent) => {
        if (!map.current || !event.features?.length) {
          return;
        }
        const feature = event.features[0];
        if (!feature || feature.geometry.type !== "Point") {
          return;
        }
        const { id, name, type } = feature.properties ?? {};
        const coords = (feature.geometry as Point).coordinates as [
          number,
          number,
        ];
        const petId =
          typeof id === "number"
            ? id
            : typeof id === "string"
              ? Number.parseInt(id, 10)
              : NaN;
        const listingHref =
          listingHrefBase && Number.isFinite(petId)
            ? `${listingHrefBase}/${petId}`
            : null;
        const avatar =
          type === "cat"
            ? "🐱"
            : type === "dog"
              ? "🐶"
              : type === "bird"
                ? "🐦"
                : "🐾";

        const html = `
          <div style="min-width:220px;border-radius:16px;border:1px solid #f1e5d3;background:#fffaf5;padding:12px 14px;font-family:inherit;box-shadow:0 18px 36px -24px rgba(15,23,42,0.4);">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:40px;height:40px;border-radius:999px;background:#fde68a;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 8px 18px -10px rgba(15,23,42,0.35);border:1px solid #f59e0b;">
                ${avatar}
              </div>
              <div>
                <div style="font-weight:700;font-size:15px;color:#0f172a;">
                  ${name ?? "Lost pet"}
                </div>
                <div style="font-size:11px;color:#8a7a63;text-transform:uppercase;letter-spacing:0.08em;">
                  ${type ?? "unknown"}
                </div>
              </div>
            </div>
            <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
              ${
                listingHref
                  ? `<a href="${listingHref}" style="display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0f172a;background:#fde68a;border-radius:999px;padding:8px 12px;border:1px solid #f59e0b;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;">${openListingLabel}</a>`
                  : `<span style="font-size:11px;color:#7c6f56;background:#fef3c7;border-radius:999px;padding:4px 8px;border:1px solid #f7e2a7;letter-spacing:0.06em;text-transform:uppercase;">details unavailable</span>`
              }
            </div>
          </div>
        `;

        new maptilersdk.Popup({ closeButton: true, closeOnClick: true })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map.current);
      };

      map.current.on("click", "unclustered-point", handlePetClick);
      map.current.on("click", "unclustered-avatar", handlePetClick);
      map.current.on("click", "unclustered-label", handlePetClick);
      map.current.on("click", "unclustered-ring", handlePetClick);

      map.current.on("mouseenter", "clusters", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "pointer";
        }
      });
      map.current.on("mouseleave", "clusters", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "";
        }
      });
      map.current.on("mouseenter", "unclustered-point", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "pointer";
        }
      });
      map.current.on("mouseleave", "unclustered-point", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "";
        }
      });
      map.current.on("mouseenter", "unclustered-avatar", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "pointer";
        }
      });
      map.current.on("mouseleave", "unclustered-avatar", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "";
        }
      });
      map.current.on("mouseenter", "unclustered-label", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "pointer";
        }
      });
      map.current.on("mouseleave", "unclustered-label", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "";
        }
      });
      map.current.on("mouseenter", "unclustered-ring", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "pointer";
        }
      });
      map.current.on("mouseleave", "unclustered-ring", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "";
        }
      });

      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
      }
      ringIntervalRef.current = setInterval(() => {
        if (!map.current) {
          return;
        }
        const t = (performance.now() % 3000) / 3000;
        const angle = t * 360;
        map.current.setLayoutProperty("unclustered-ring", "icon-rotate", angle);
      }, 60);

      sourcesReadyRef.current = true;
      if (pendingClusterRefreshRef.current) {
        pendingClusterRefreshRef.current = false;
        skipNextMoveendRef.current = true;
        void refreshClusters();
      } else {
        skipNextMoveendRef.current = true;
        void refreshClusters();
      }
    };

    if (map.current.isStyleLoaded()) {
      setupSources();
    } else {
      map.current.once("load", setupSources);
    }

    const center = map.current?.getCenter();
    if (center && enableCenterMarker) {
      triggerReverseGeocode(center.lng, center.lat);
    }
    return () => {
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
      }
    };
  }, []);

  const handleLocate = (manual = false) => {
    if (!map.current || !navigator.geolocation) {
      return;
    }
    if (manual) {
      onLocateRequest?.();
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        updatePosition(longitude, latitude);
        map.current?.easeTo({ center: [longitude, latitude], zoom: 14 });
        triggerReverseGeocode(longitude, latitude);
        if (!userMarkerRef.current) {
          const el = document.createElement("div");
          el.style.width = "14px";
          el.style.height = "14px";
          el.style.borderRadius = "999px";
          el.style.background = "#0ea5e9";
          el.style.boxShadow = "0 0 0 6px rgba(14,165,233,0.25)";
          el.style.border = "2px solid #ffffff";
          if (map.current) {
            userMarkerRef.current = new maptilersdk.Marker({ element: el })
              .setLngLat([longitude, latitude])
              .addTo(map.current);
          }
        } else {
          userMarkerRef.current.setLngLat([longitude, latitude]);
        }
        setLocating(false);
      },
      (error) => {
        onLocateError?.(error);
        if (clusterRequestIdRef.current === 0) {
          void refreshClusters();
        }
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    if (!map.current) {
      return;
    }

    const handleRefresh = async () => {
      if (!map.current) {
        return;
      }
      if (skipNextMoveendRef.current) {
        skipNextMoveendRef.current = false;
        return;
      }
      if (!sourcesReadyRef.current) {
        return;
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(async () => {
        if (!map.current) {
          return;
        }
        await refreshClusters();
        const center = map.current.getCenter();
        if (center && enableCenterMarker) {
          triggerReverseGeocode(center.lng, center.lat);
        }
      }, CLUSTER_REFRESH_DEBOUNCE_MS);
    };

    map.current.on("moveend", handleRefresh);
    return () => {
      map.current?.off("moveend", handleRefresh);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof locateRequestId !== "number" || locateRequestId === 0) {
      return;
    }
    handleLocate(false);
  }, [locateRequestId]);

  useEffect(() => {
    if (typeof manualLocateRequestId !== "number") {
      return;
    }
    handleLocate(true);
  }, [manualLocateRequestId]);

  useEffect(() => {
    if (typeof clustersRequestId !== "number" || clustersRequestId === 0) {
      return;
    }
    void refreshClusters();
  }, [clustersRequestId]);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div className="geocoding absolute left-4 top-4 z-10 flex items-start gap-2">
        {showSearchControl && mapController && (
          <GeocodingControl
            apiKey={maptilersdk.config.apiKey}
            mapController={mapController}
            onSelect={(selected) => {
              const feature = selected?.feature;
              if (feature?.geometry?.type === "Point") {
                const [lng, lat] = feature.geometry.coordinates;
                if (typeof lng === "number" && typeof lat === "number") {
                  updatePosition(lng, lat);
                  map.current?.easeTo({
                    center: [lng, lat],
                    zoom: Math.max(map.current?.getZoom() ?? 0, 15),
                    duration: 700,
                  });
                  triggerReverseGeocode(lng, lat);
                }
              }
            }}
          />
        )}
        {showLocateButton && (
          <Button
            buttonType="mint"
            size="sm"
            shape="pill"
            onClick={() => handleLocate(true)}
            className="m-0 uppercase tracking-wide"
            innerClassName="inline-flex items-center gap-2"
            ariaLabel={locateLabel}
            disabled={locating}
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            {locating ? locatingLabel : locateLabel}
          </Button>
        )}
      </div>
      <div ref={mapContainer} className="map absolute h-full w-full" />
    </div>
  );
}
