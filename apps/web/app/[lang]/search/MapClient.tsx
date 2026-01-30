"use client";

import { useEffect, useRef, useState } from "react";
import Map from "../../components/Map/Map";

type MapClientProps = {
  mapHeightClassName?: string;
  locationLabel?: string;
  locationPlaceholder?: string;
  locateLabel?: string;
  locatingLabel?: string;
  locationDenied?: string;
  locationHint?: string;
};

export default function MapClient({
  mapHeightClassName = "h-[480px] sm:h-[600px]",
  locationLabel = "Location",
  locationPlaceholder = "Move the map to see the street and city.",
  locateLabel = "Locate me",
  locatingLabel = "Locating...",
  locationDenied = "Location access is off.",
  locationHint = "Enable it in Chrome to use GPS.",
}: MapClientProps) {
  const [location, setLocation] = useState<string>("");
  const [permissionState, setPermissionState] = useState<
    "granted" | "denied" | "prompt" | "unknown"
  >("unknown");
  const [locateRequestId, setLocateRequestId] = useState(0);
  const deniedRef = useRef<HTMLDivElement | null>(null);
  const [highlightDenied, setHighlightDenied] = useState(false);
  const [userLocateRequestId, setUserLocateRequestId] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const runPermissionCheck = async () => {
      if (typeof navigator === "undefined") {
        return;
      }

      if ("permissions" in navigator) {
        try {
          const status = await navigator.permissions.query({
            name: "geolocation",
          });

          if (!isMounted) {
            return;
          }

          const nextState = status.state as
            | "granted"
            | "denied"
            | "prompt";
          setPermissionState(nextState);
          if (nextState !== "denied") {
            setLocateRequestId((prev) => prev + 1);
          }

          status.onchange = () => {
            const updated = status.state as
              | "granted"
              | "denied"
              | "prompt";
            if (isMounted) {
              setPermissionState(updated);
              if (updated !== "denied") {
                setLocateRequestId((prev) => prev + 1);
              }
            }
          };
        } catch {
          setPermissionState("unknown");
          setLocateRequestId((prev) => prev + 1);
        }
      } else {
        setPermissionState("unknown");
        setLocateRequestId((prev) => prev + 1);
      }
    };

    runPermissionCheck();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (permissionState !== "denied" || userLocateRequestId === 0) {
      return;
    }
    deniedRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setHighlightDenied(true);
    const timeout = setTimeout(() => {
      setHighlightDenied(false);
    }, 1400);
    return () => clearTimeout(timeout);
  }, [permissionState, userLocateRequestId]);

  return (
    <div className="space-y-3">
      <div className={mapHeightClassName}>
        <Map
          locateLabel={locateLabel}
          locatingLabel={locatingLabel}
          locateRequestId={locateRequestId}
          onLocateRequest={() => {
            setUserLocateRequestId((prev) => prev + 1);
          }}
          onLocationChange={(next) => {
            setLocation(next.label);
          }}
        />
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-[0_12px_22px_-18px_rgba(31,41,55,0.35)]">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {locationLabel}
        </span>
        <span className="text-sm font-semibold text-slate-900">
          {location || locationPlaceholder}
        </span>
      </div>
      {permissionState === "denied" && (
        <div
          ref={deniedRef}
          className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-[0_12px_22px_-18px_rgba(245,158,11,0.35)] transition ${
            highlightDenied ? "ring-2 ring-amber-300/70" : ""
          }`}
        >
          <span className="font-semibold uppercase tracking-wide">
            {locationDenied}
          </span>
          <span className="ml-2">{locationHint}</span>
        </div>
      )}
    </div>
  );
}
