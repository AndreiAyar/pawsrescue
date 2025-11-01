"use client";

import { useEffect, useRef, useState } from "react";
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
  const intialPos = { lang: 26.102, lat: 44.435 };
  const zoom = 17;
  maptilersdk.config.apiKey = "";

  const updatePosition = (lng: number, lat: number) => {
    markerRef.current?.setLngLat([lng, lat]);
    setCurrentPosition({ lng, lat });
  };
  useEffect(() => {
    if (map.current) return; // stops map from intializing more than once
    if (!mapContainer.current) return; // ensure container is available

    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: maptilersdk.MapStyle.STREETS,
      center: [intialPos.lang, intialPos.lat],
      zoom: zoom,
    });

    const controller = createMapLibreGlMapController(map.current, maptilersdk);
    setMapController(controller);

    const marker = new maptilersdk.Marker({
      color: "red",
    })
      .setLngLat([intialPos.lang, intialPos.lat])
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

        
        console.log('map bounds',bounds?.getWest(), bounds?.getSouth(), bounds?.getEast(), bounds?.getSouth())
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
  }, [intialPos.lang, intialPos.lat, zoom]);

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
