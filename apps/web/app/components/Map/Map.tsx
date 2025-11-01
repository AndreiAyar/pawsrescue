"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maptilersdk from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { GeocodingControl } from "@maptiler/geocoding-control/react";
import { createMapLibreGlMapController } from "@maptiler/geocoding-control/maplibregl-controller";
import "@maptiler/geocoding-control/style.css";

export default function Map() {
  const [mapController, setMapController] = useState<
    ReturnType<typeof createMapLibreGlMapController> | undefined
  >(undefined);
  const [currentPosition, setCurrentPosition] = useState({ lng: 0, lat: 0 });

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<maptilersdk.Marker | null>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const intialPosRef = useRef({ lang: 26.102, lat: 44.435 });

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
      map?.current?.addSource("lostPetsJson", {
        type: "geojson",
        data: `http://localhost:3015/lost-pets/clusters?bbox=${getBounds()}&zoom=${zoom}`,
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
  }, [currentPosition]);

  useEffect(() => {
    map?.current?.on("moveend", async () => {
      if (!map || !map?.current) {
        return;
      }

      const zoom = map?.current?.getZoom();

      // Ask your backend only for the visible area
      const res = await fetch(
        `http://localhost:3015/lost-pets/clusters?bbox=${getBounds()}&zoom=${zoom}`
      );
      const geojson = await res.json();

      const source = map?.current?.getSource("lostPetsJson") as
        | maptilersdk.GeoJSONSource
        | undefined;
      source?.setData(geojson);
    });
  }, []);

  return (
    <div className="relative bg-yellow-500 m-auto w-[calc(100%-100px)] h-[500px] p-20">
      <div className="geocoding absolute top-[10px] left-[10px]">
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
      </div>
      <div ref={mapContainer} className="map absolute h-full w-full" />
      <div className="bg-red-500 text-2xl">
        <p>Lng{currentPosition.lng}</p>
        <p>Lat{currentPosition.lat}</p>
      </div>
    </div>
  );
}
