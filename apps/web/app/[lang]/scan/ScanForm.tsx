"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { FileUpload } from "@repo/ui/fileUpload";
import { FormField } from "@repo/ui/formField";
import { Input } from "@repo/ui/input";

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
    embeddingTitle: string;
    embeddingPending: string;
    embeddingModel: string;
    embeddingFallback: string;
    embeddingYes: string;
    embeddingNo: string;
    embeddingWarning: string;
    matchDistance: string;
    matchDistanceHint: string;
  };
};

type QueryEmbeddingInfo = {
  model: string;
  fallbackUsed: boolean;
  warning: string | null;
};

export default function ScanForm({ lang, labels }: ScanFormProps) {
  const [city, setCity] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [queryEmbedding, setQueryEmbedding] = useState<QueryEmbeddingInfo | null>(
    null
  );
  const [results, setResults] = useState<
    Array<{
      id: number;
      name: string;
      type: string;
      city: string | null;
      imageUrl: string | null;
      score: number;
    }>
  >([]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setResults([]);
    setQueryEmbedding(null);

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
        setError(data?.message ?? data?.detail ?? "Could not scan for matches.");
        return;
      }

      setQueryEmbedding(
        data?.queryEmbedding &&
          typeof data.queryEmbedding.model === "string" &&
          typeof data.queryEmbedding.fallbackUsed === "boolean"
          ? {
              model: data.queryEmbedding.model,
              fallbackUsed: data.queryEmbedding.fallbackUsed,
              warning:
                typeof data.queryEmbedding.warning === "string"
                  ? data.queryEmbedding.warning
                  : null,
            }
          : null
      );
      setResults(Array.isArray(data?.matches) ? data.matches : []);
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Could not scan for matches."
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
                    onChange={(event) => {
                      setPhotos(
                        event.target.files ? Array.from(event.target.files) : []
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

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {labels.embeddingTitle}
              </p>
              {queryEmbedding ? (
                <div className="mt-2 space-y-1">
                  <p>
                    <span className="font-semibold">{labels.embeddingModel}:</span>{" "}
                    {queryEmbedding.model}
                  </p>
                  <p>
                    <span className="font-semibold">
                      {labels.embeddingFallback}:
                    </span>{" "}
                    {queryEmbedding.fallbackUsed
                      ? labels.embeddingYes
                      : labels.embeddingNo}
                  </p>
                  {queryEmbedding.warning ? (
                    <p className="text-amber-700">
                      <span className="font-semibold">
                        {labels.embeddingWarning}:
                      </span>{" "}
                      {queryEmbedding.warning}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-slate-600">{labels.embeddingPending}</p>
              )}
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
                        {result.imageUrl ? (
                          <img
                            src={result.imageUrl}
                            alt={result.name}
                            className="h-full w-full object-cover"
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
                            <h3 className="text-lg font-semibold">{result.name}</h3>
                            <p className="text-sm text-slate-500">
                              {result.type} {result.city ? `· ${result.city}` : ""}
                            </p>
                          </div>
                          <span className="rounded-full bg-[color:var(--butter)] px-3 py-1 text-xs font-semibold uppercase text-amber-800">
                            {labels.matchDistance} {result.score.toFixed(3)}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          {labels.matchDistanceHint}
                        </p>

                        <Link
                          href={`/${lang}/pets/${result.id}`}
                          className="mt-4 inline-block text-sm font-semibold underline decoration-2 underline-offset-4"
                        >
                          {labels.openListing}
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
