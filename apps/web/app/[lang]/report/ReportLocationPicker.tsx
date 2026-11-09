"use client";

import { useState } from "react";
import MapView from "../../components/Map/Map";

type ReportLocationPickerProps = {
  addressLabel: string;
  addressPlaceholder: string;
  locateLabel: string;
  locatingLabel: string;
  locationDenied: string;
  locationHint: string;
  eyebrow: string;
  title: string;
  badge: string;
  onLocationChange: (location: {
    label: string;
    city?: string;
    street?: string;
    latitude?: number;
    longitude?: number;
  }) => void;
};

export default function ReportLocationPicker({
  addressLabel,
  addressPlaceholder,
  locateLabel,
  locatingLabel,
  locationDenied,
  locationHint,
  eyebrow,
  title,
  badge,
  onLocationChange,
}: ReportLocationPickerProps) {
  const [locationLabel, setLocationLabel] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,250,245,0.96),rgba(255,255,255,0.9))] shadow-[0_24px_60px_-32px_rgba(15,23,42,0.38)]">
      <div className="border-b border-slate-200/80 bg-white/75 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              {eyebrow}
            </p>
            <h2 className="mt-1 font-display text-xl font-black text-slate-900">
              {title}
            </h2>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            {badge}
          </span>
        </div>
      </div>

      <div className="relative h-[320px] sm:h-[380px]">
        <MapView
          className="bg-[#f7f1e8]"
          enableCenterMarker
          showLocateButton
          locateLabel={locateLabel}
          locatingLabel={locatingLabel}
          maxReverseGeocodeRequests={40}
          onLocateError={(error) => {
            if (error.code === 1) {
              setPermissionDenied(true);
            }
          }}
          onLocationChange={(next) => {
            setLocationLabel(next.label);
            onLocationChange(next);
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/95 via-white/75 to-transparent px-5 pb-4 pt-10">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-[0_14px_28px_-20px_rgba(15,23,42,0.45)] backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {addressLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {locationLabel || addressPlaceholder}
            </p>
          </div>
        </div>
      </div>

      {permissionDenied ? (
        <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900">
          <span className="font-semibold uppercase tracking-wide">
            {locationDenied}
          </span>
          <span className="ml-2">{locationHint}</span>
        </div>
      ) : null}
    </div>
  );
}
