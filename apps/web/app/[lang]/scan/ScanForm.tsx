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
    idleTitle: string;
    noResultsTitle: string;
    noResultsBody: string;
    searchingTitle: string;
    searchingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    invalidPhoto: string;
    choosePhoto: string;
    browseMap: string;
    tryPhoto: string;
    allAreas: string;
    resultsHint: string;
    fullPhotoNotice: string;

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
  const [searched, setSearched] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [fullPhoto, setFullPhoto] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  const selectedResult =
    results.find((result) => result.id === selectedResultId) ?? results[0];

  const search = async (searchCity = city) => {
    setError("");
    if (photos.length === 0) {
      setError(labels.choosePhoto);
      return;
    }
    if (photos.some((photo) => photo.size > 8 * 1024 * 1024)) {
      setError(labels.invalidPhoto);
      return;
    }
    setSubmitting(true);
    setUnavailable(false);
    setSearched(false);
    setFullPhoto(false);
    setResults([]);
    setSelectedResultId(null);
    const payload = new FormData();
    if (searchCity.trim()) payload.set("city", searchCity.trim());
    photos.forEach((photo) => payload.append("photos", photo));
    try {
      const response = await fetch("/api/lost-pets/match", {
        method: "POST",
        body: payload,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if ([400, 413, 422].includes(response.status))
          setError(labels.invalidPhoto);
        else setUnavailable(true);
        return;
      }
      if (!Array.isArray(data?.matches) || data?.queryEmbedding?.fallbackUsed) {
        setUnavailable(true);
        return;
      }
      const matches = data.matches as ScanResult[];
      setResults(matches);
      setSelectedResultId(matches[0]?.id ?? null);
      setFullPhoto(Boolean(data.queryEmbedding?.warning));
      setSearched(true);
    } catch {
      setUnavailable(true);
    } finally {
      setSubmitting(false);
    }
  };
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void search();
  };
  const stateTitle = submitting
    ? labels.searchingTitle
    : unavailable
      ? labels.unavailableTitle
      : searched
        ? labels.noResultsTitle
        : labels.idleTitle;
  const stateBody = submitting
    ? labels.searchingBody
    : unavailable
      ? labels.unavailableBody
      : searched
        ? labels.noResultsBody
        : labels.empty;

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
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              buttonType="mint"
              className="mt-6 w-full sm:w-auto"
              innerClassName="w-full whitespace-nowrap px-8"
              disabled={submitting}
            >
              {submitting ? labels.submitting : labels.submit}
            </Button>
          </form>

          <section
            aria-busy={submitting}
            aria-live="polite"
            className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">
                {labels.resultsTitle}
              </h2>
              {results.length > 0 ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  {results.length}
                </span>
              ) : null}
            </div>

            {results.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center px-3 py-10 text-center sm:px-6">
                <div
                  className={`mb-6 grid h-20 w-20 place-items-center rounded-[1.75rem] border border-amber-200 bg-amber-50 text-amber-900 ${submitting ? "animate-pulse" : ""}`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 48 48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-11 w-11"
                  >
                    <path
                      d="M12 23V12l9 5a18 18 0 0 1 7 0l8-5v12c2 12-3 17-12 17S10 35 12 23Z"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M18 27h.01M30 27h.01M22 32l2 2 2-2M8 29l8 1M32 30l8-1"
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
                <h3 className="max-w-sm font-display text-2xl font-bold leading-tight text-slate-900">
                  {stateTitle}
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
                  {stateBody}
                </p>
                {!submitting ? (
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {searched || unavailable ? (
                      <button
                        type="button"
                        onClick={() =>
                          document.getElementById("photos")?.click()
                        }
                        className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4"
                      >
                        {labels.tryPhoto}
                      </button>
                    ) : null}
                    <Link
                      href={`/${lang}/search`}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-amber-50"
                    >
                      {labels.browseMap}
                    </Link>
                  </div>
                ) : null}
                {searched && city.trim() && !submitting ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCity("");
                      void search("");
                    }}
                    className="mt-4 text-sm font-semibold underline underline-offset-4"
                  >
                    {labels.allAreas}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                <p className="text-sm leading-6 text-slate-600">
                  {labels.resultsHint}
                </p>
                {fullPhoto ? (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {labels.fullPhotoNotice}
                  </p>
                ) : null}
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
