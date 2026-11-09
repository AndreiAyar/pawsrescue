"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("../../../components/Map/Map"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-amber-50" />,
});

type PetLocationMapProps = {
  latitude: number;
  longitude: number;
  name: string;
};

export default function PetLocationMap({
  latitude,
  longitude,
  name,
}: PetLocationMapProps) {
  return (
    <div className="h-80 overflow-hidden rounded-xl border border-slate-200 sm:h-96">
      <MapView
        focusLocation={{ latitude, longitude, label: name }}
        showLocateButton={false}
        showSearchControl={false}
        maxReverseGeocodeRequests={0}
      />
    </div>
  );
}
