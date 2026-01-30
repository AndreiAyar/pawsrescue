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
        const bounds = map.current?.getBounds();

        console.log(
          "map bounds",
          bounds?.getWest(),
          bounds?.getSouth(),
          bounds?.getEast(),
          bounds?.getSouth()
        );
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
    if (!map || !map?.current) {
      return;
    }

    map?.current?.on("load", function () {
      // add a clustered GeoJSON source for a sample set of earthquakes
      const clustersUrl = getClustersUrl(zoom);
      if (!clustersUrl) {
        return;
      }

      map?.current?.addSource("lostPetsJson", {
        type: "geojson",
        data: clustersUrl,
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
      });

      map?.current?.addLayer({
        id: "clusters",
        type: "circle",
        source: "lostPetsJson",
        filter: ["has", "point_count"],
        paint: {
          // Use step expressions (https://docs.maptiler.com/gl-style-specification/expressions/#step)
          // with three steps to implement three types of circles:
          //   * Blue, 20px circles when point count is less than 100
          //   * Yellow, 30px circles when point count is between 100 and 750
          //   * Pink, 40px circles when point count is greater than or equal to 750
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

      map?.current?.addLayer({
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

      map?.current?.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "lostPetsJson",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#11b4da",
          "circle-radius": 4,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
        },
      });
    });

    const center = map.current?.getCenter();
    if (center) {
      triggerReverseGeocode(center.lng, center.lat);
    }
  }, [currentPosition]);

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
