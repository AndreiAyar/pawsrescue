"use client";
import * as maptilersdk from "@maptiler/sdk";
import { useEffect, useRef } from "react";
export default function Map() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const tokyo = { lng: 139.753, lat: 35.6844 };
  const zoom = 14;
  maptilersdk.config.apiKey = "";

useEffect(() => {
  if (map.current) return; // stops map from intializing more than once
  if (!mapContainer.current) return; // ensure container is available

  map.current = new maptilersdk.Map({
    container: mapContainer.current,
    style: maptilersdk.MapStyle.STREETS,
    center: [tokyo.lng, tokyo.lat],
    zoom: zoom
  });

}, [tokyo.lng, tokyo.lat, zoom]);

  return <div className="relative m-auto w-[calc(100%-100px)] h-[500px]">
     <div ref={mapContainer} className="map absolute h-full w-full"  />;
    </div>
    
    
   
}
