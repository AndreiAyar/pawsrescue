"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@repo/ui/button";
import { FileUpload } from "@repo/ui/fileUpload";
import { FormField } from "@repo/ui/formField";
import { ImageLightbox } from "@repo/ui/imageLightbox";
import { Input } from "@repo/ui/input";

const ResultMap = dynamic(() => import("../../components/Map/Map"), {
  ssr: false,
});

type ScanFormProps = {
  lang: string;
  labels: {
    title: string;
    intro: string;
    backHome: string;
    cityLabel: string;
    cityPlaceholder: string;
    photosLabel: string;
    photosHint: string;
    submit: string;
    submitting: string;
    empty: string;
    resultsTitle: string;
    openListing: string;
    matchPercent: string;
    locationTitle: string;
    showOnMap: string;
    selectedOnMap: string;
  };
};

type ScanResult = {
  id: number;
  name: string;
  type: string;
  city: string | null;
  imageUrl: string | null;
  latitude: number;
  longitude: number;
  score: number;
};

function getMatchPercent(score: number) {
  const cosineSimilarity = 1 - Math.max(0, Math.min(score, 1));
  return Math.round(cosineSimilarity * 100);
}

function getResultImageUrl(imageUrl: string | null) {
  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    return `/api${imageUrl}`;
  }

  return `/api/${imageUrl}`;
}

export default function ScanForm({ lang, labels }: ScanFormProps) {
  const [city, setCity] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ScanResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  const selectedResult =
    results.find((result) => result.id === selectedResultId) ?? results[0];

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setResults([]);
    setSelectedResultId(null);

    const payload = new FormData();
    if (city.trim()) {
      payload.set("city", city.trim());
    }
    photos.forEach((photo) => payload.append("photos", photo));

    try {
      const response = await fetch("/api/lost-pets/match", {
        method: "POST",
        body: payload,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.message ?? data?.detail ?? "Could not scan for matches.",
        );
        return;
      }

      const matches = Array.isArray(data?.matches)
        ? (data.matches as ScanResult[])
        : [];
      setResults(matches);
      setSelectedResultId(matches[0]?.id ?? null);
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Could not scan for matches.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-warm-texture text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8">
          <Link
            href={`/${lang}`}
            className="text-sm font-semibold underline decoration-2 underline-offset-4"
          >
            {labels.backHome}
          </Link>
          <h1 className="mt-4 font-display text-3xl font-black sm:text-4xl">
            {labels.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-700 sm:text-base">
            {labels.intro}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]"
          >
            <FormField label={labels.cityLabel} name="city">
              <Input
                id="city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder={labels.cityPlaceholder}
              />
            </FormField>

            <div className="mt-4">
              <FormField label={labels.photosLabel} name="photos">
                <div className="space-y-2">
                  <FileUpload
                    id="photos"
                    name="photos"
                    maxFiles={4}
                    files={photos}
                    onChange={(event) => {
                      setPhotos(
                        event.target.files
                          ? Array.from(event.target.files)
                          : [],
                      );
                    }}
                  />
                  <p className="text-xs text-slate-500">{labels.photosHint}</p>
                </div>
              </FormField>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              buttonType="mint"
              className="mt-6"
              innerClassName="w-full sm:w-auto"
              disabled={submitting}
            >
              {submitting ? labels.submitting : labels.submit}
            </Button>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">
                {labels.resultsTitle}
              </h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                {results.length}
              </span>
            </div>

            {results.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">{labels.empty}</p>
            ) : (
              <div className="mt-4 grid gap-4">
                {results.map((result) => (
                  <article
                    key={result.id}
                    className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_12px_24px_-20px_rgba(31,41,55,0.35)]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="h-28 w-full overflow-hidden rounded-xl bg-slate-100 sm:w-36">
                        {getResultImageUrl(result.imageUrl) ? (
                          <ImageLightbox
                            src={getResultImageUrl(result.imageUrl) ?? ""}
                            alt={result.name}
                            buttonClassName="h-full w-full bg-slate-100"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">
                            No photo
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold">
                              {result.name}
                            </h3>
                            <p className="text-sm text-slate-500">
                              {result.type}{" "}
                              {result.city ? `· ${result.city}` : ""}
                            </p>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-800">
                            {getMatchPercent(result.score)}%{" "}
                            {labels.matchPercent}
                          </span>
                        </div>

                        <Link
                          href={`/${lang}/pets/${result.id}`}
                          className="mt-4 inline-block text-sm font-semibold underline decoration-2 underline-offset-4"
                        >
                          {labels.openListing}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setSelectedResultId(result.id)}
                          className={`ml-3 mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${selectedResult?.id === result.id ? "bg-amber-300 text-slate-950" : "bg-slate-100 text-slate-700 hover:bg-amber-100"}`}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-4 w-4"
                          >
                            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                          {selectedResult?.id === result.id
                            ? labels.selectedOnMap
                            : labels.showOnMap}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}

                {selectedResult ? (
                  <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-[0_18px_34px_-24px_rgba(120,53,15,0.45)]">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">
                          {labels.locationTitle}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {selectedResult.name}
                          {selectedResult.city
                            ? ` · ${selectedResult.city}`
                            : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-amber-200">
                        {selectedResult.latitude.toFixed(4)},{" "}
                        {selectedResult.longitude.toFixed(4)}
                      </span>
                    </div>
                    <div className="h-72 w-full sm:h-80">
                      <ResultMap
                        showLocateButton={false}
                        showSearchControl={false}
                        maxReverseGeocodeRequests={0}
                        listingHrefBase={`/${lang}/pets`}
                        openListingLabel={labels.openListing}
                        focusLocation={{
                          latitude: selectedResult.latitude,
                          longitude: selectedResult.longitude,
                          label: selectedResult.name,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
