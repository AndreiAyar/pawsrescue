"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maptilersdk from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { GeocodingControl } from "@maptiler/geocoding-control/react";
import { createMapLibreGlMapController } from "@maptiler/geocoding-control/maplibregl-controller";
import "@maptiler/geocoding-control/style.css";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
const apiBase = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;

type MapProps = {
  className?: string;
  onLocationChange?: (location: {
    street?: string;
    city?: string;
    label: string;
  }) => void;
  locateLabel?: string;
  locatingLabel?: string;
  locateRequestId?: number;
  onLocateRequest?: () => void;
};

export default function Map({
  className = "",
  onLocationChange,
  locateLabel = "Locate me",
  locatingLabel = "Locating...",
  locateRequestId,
  onLocateRequest,
}: MapProps) {
  const [mapController, setMapController] = useState<
    ReturnType<typeof createMapLibreGlMapController> | undefined
  >(undefined);
  const [currentPosition, setCurrentPosition] = useState({ lng: 0, lat: 0 });
  const [locating, setLocating] = useState(false);

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<maptilersdk.Marker | null>(null);
  const userMarkerRef = useRef<maptilersdk.Marker | null>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const intialPosRef = useRef({ lang: 26.102, lat: 44.435 });
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const sourcesReadyRef = useRef(false);

  const zoom = useMemo(() => 5, []);
  maptilersdk.config.apiKey = "";

  const updatePosition = (lng: number, lat: number) => {
    markerRef.current?.setLngLat([lng, lat]);
    setCurrentPosition({ lng, lat });
  };

  const getBounds = () => {
    const bounds = map?.current?.getBounds();

    // Convert bounds to [west, south, east, north]
    const bbox = bounds?.toArray().flat();

    // Ask your backend only for the visible area
    return bbox?.join(",");
  };

  const getClustersUrl = (zoomLevel: number) => {
    const bbox = getBounds();
    if (!bbox) {
      return null;
    }
    return `${apiBase}/lost-pets/clusters?bbox=${bbox}&zoom=${zoomLevel}`;
  };

  const triggerReverseGeocode = (lng: number, lat: number) => {
    if (!onLocationChange || !maptilersdk.config.apiKey) {
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

      try {
        const res = await fetch(
          `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${maptilersdk.config.apiKey}`,
          { signal: controller.signal }
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
          feature.place_type?.includes("address")
        );
        const place = features.find((feature) =>
          feature.place_type?.some((type) =>
            ["place", "locality", "municipality"].includes(type)
          )
        );

        const street =
          address?.text ?? address?.place_name?.split(",")[0]?.trim();
        const city = place?.text;
        const label =
          [street, city].filter(Boolean).join(", ") ||
          features[0]?.place_name ||
          "";

        onLocationChange({ street, city, label });
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

    const marker = new maptilersdk.Marker({
      color: "red",
    })
      .setLngLat([initialPos.lang, initialPos.lat])
      .addTo(map.current);
    markerRef.current = marker;

    // Move marker when map is clicked
    if (map.current) {
      map.current.on("click", (e: { lngLat: { lng: number; lat: number } }) => {
        const { lng, lat } = e.lngLat;
        updatePosition(lng, lat);
      });

      map.current.on("move", () => {
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
      }
    };
  }, [intialPosRef?.current?.lang, intialPosRef?.current?.lat]);

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

      const clustersUrl = getClustersUrl(zoom);
      if (!clustersUrl) {
        return;
      }

      map.current.addSource("lostPetsJson", {
        type: "geojson",
        data: clustersUrl,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
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
          "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
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

      addEmojiIcon("pet-cat", "🐱", "#fef3c7");
      addEmojiIcon("pet-dog", "🐶", "#fde2e2");
      addEmojiIcon("pet-bird", "🐦", "#e0f2fe");
      addEmojiIcon("pet-default", "🐾", "#fef9c3");

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
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
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
        const source = map.current.getSource(
          "lostPetsJson"
        ) as maptilersdk.GeoJSONSource | null;
        const clusterId = clusterFeature.properties?.cluster_id;
        if (!source || typeof clusterId !== "number") {
          return;
        }
        source.getClusterExpansionZoom(clusterId, (error, nextZoom) => {
          if (error || !map.current) {
            return;
          }
          map.current.easeTo({
            center: clusterFeature.geometry.coordinates as [number, number],
            zoom: nextZoom,
          });
        });
      });

      map.current.on("click", "unclustered-point", (event) => {
        if (!map.current || !event.features?.length) {
          return;
        }
        const feature = event.features[0];
        if (!feature || feature.geometry.type !== "Point") {
          return;
        }
        const { name, type } = feature.properties ?? {};
        const coords = feature.geometry.coordinates as [number, number];
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
              <span style="font-size:11px;color:#7c6f56;background:#fef3c7;border-radius:999px;padding:4px 8px;border:1px solid #f7e2a7;letter-spacing:0.06em;text-transform:uppercase;">
                tap for details
              </span>
            </div>
          </div>
        `;

        new maptilersdk.Popup({ closeButton: true, closeOnClick: true })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map.current);
      });

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

      sourcesReadyRef.current = true;
    };

    if (map.current.isStyleLoaded()) {
      setupSources();
    } else {
      map.current.once("load", setupSources);
    }

    const center = map.current?.getCenter();
    if (center) {
      triggerReverseGeocode(center.lng, center.lat);
    }
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
          userMarkerRef.current = new maptilersdk.Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(map.current);
        } else {
          userMarkerRef.current.setLngLat([longitude, latitude]);
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    map?.current?.on("moveend", async () => {
      if (!map || !map?.current) {
        return;
      }

      const zoom = map?.current?.getZoom();

      // Ask your backend only for the visible area
      const clustersUrl = getClustersUrl(zoom ?? 0);
      if (!clustersUrl) {
        return;
      }

      const res = await fetch(clustersUrl);
      const geojson = await res.json();

      const source = map?.current?.getSource("lostPetsJson") as
        | maptilersdk.GeoJSONSource
        | undefined;

      source?.setData(geojson);

      const center = map?.current?.getCenter();
      if (center) {
        triggerReverseGeocode(center.lng, center.lat);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof locateRequestId !== "number") {
      return;
    }
    handleLocate(false);
  }, [locateRequestId]);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div className="geocoding absolute left-4 top-4 z-10 flex items-start gap-2">
        {mapController && (
          <GeocodingControl
            apiKey={maptilersdk.config.apiKey}
            mapController={mapController}
            onSelect={(selected) => {
              const feature = selected?.feature;
              if (feature?.geometry?.type === "Point" && markerRef.current) {
                const [lng, lat] = feature.geometry.coordinates;
                if (typeof lng === "number" && typeof lat === "number") {
                  //Skip for the moment
                  //   markerRef.current.setLngLat([lng, lat]);
                  //   // Optionally center the map on the new location
                  //   map.current?.easeTo({
                  //     center: [lng, lat],
                  //     zoom: 15,
                  //     duration: 1000
                  //   });
                }
              }
            }}
          />
        )}
        <button
          type="button"
          onClick={() => handleLocate(true)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50"
          aria-label={locateLabel}
          disabled={locating}
        >
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          {locating ? locatingLabel : locateLabel}
        </button>
      </div>
      <div ref={mapContainer} className="map absolute h-full w-full" />
    </div>
  );
}
