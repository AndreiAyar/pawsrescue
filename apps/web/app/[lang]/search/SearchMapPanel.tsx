"use client";

import { useState } from "react";
import MapClient from "./MapClient";

type SearchMapPanelProps = {
  title: string;
  badge: string;
  locateLabel: string;
  locatingLabel: string;
  locationLabel: string;
  locationPlaceholder: string;
  locationDenied: string;
  locationHint: string;
};

export default function SearchMapPanel({
  title,
  badge,
  locateLabel,
  locatingLabel,
  locationLabel,
  locationPlaceholder,
  locationDenied,
  locationHint,
}: SearchMapPanelProps) {
  const [manualLocateRequestId, setManualLocateRequestId] = useState(0);

  return (
    <div
      className="search-map-panel relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_22px_60px_-38px_rgba(31,41,55,0.45)]"
    >
      <style jsx global>{`
        .search-map-panel .maptiler-geocoding-control input,
        .search-map-panel .maptiler-geocoding-control .maptiler-geocoding-input,
        .search-map-panel .maplibregl-ctrl-geocoder--input {
          font-size: 16px !important;
          line-height: 1.4 !important;
        }
      `}</style>
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-4 sm:py-3">
        <span>{title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setManualLocateRequestId((prev) => prev + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 sm:hidden"
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            {locateLabel}
          </button>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800">
            {badge}
          </span>
        </div>
      </div>
      <div className="px-1.5 py-3 sm:p-4">
        <MapClient
          mapHeightClassName="h-[420px] sm:h-[600px]"
          locationLabel={locationLabel}
          locationPlaceholder={locationPlaceholder}
          locateLabel={locateLabel}
          locatingLabel={locatingLabel}
          locationDenied={locationDenied}
          locationHint={locationHint}
          manualLocateRequestId={manualLocateRequestId}
          showLocateButton={false}
        />
      </div>
    </div>
  );
}
