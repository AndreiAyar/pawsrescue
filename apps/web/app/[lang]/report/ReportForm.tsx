"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { FileUpload } from "@repo/ui/fileUpload";
import { FormField } from "@repo/ui/formField";
import { Input } from "@repo/ui/input";
import { Select } from "@repo/ui/select";
import ReportLocationPicker from "./ReportLocationPicker";

type ReportFormProps = {
  lang: string;
  labels: {
    title: string;
    intro: string;
    backHome: string;
    successTitle: string;
    successBody: string;
    viewApi: string;
    submit: string;
    submitting: string;
    map: {
      locationLabel: string;
      locationPlaceholder: string;
      locate: string;
      locating: string;
      denied: string;
      hint: string;
    };
    ui: {
      mapEyebrow: string;
      mapTitle: string;
      mapBadge: string;
      quickStatus: string;
      lastSeenArea: string;
      cityAuto: string;
      photosSelected: string;
      draftHint: string;
      flowIdentity: string;
      flowContact: string;
      flowPhotos: string;
      apiTitle: string;
      visualCheck: string;
      visualLineOne: string;
      visualLineTwo: string;
      visualLineThree: string;
    };
    fields: {
      name: string;
      type: string;
      email: string;
      phone: string;
      city: string;
      location: string;
      latitude: string;
      longitude: string;
      description: string;
      photos: string;
    };
    placeholders: {
      name: string;
      email: string;
      phone: string;
      city: string;
      location: string;
      latitude: string;
      longitude: string;
      description: string;
      petType: string;
      photos: string;
    };
    types: {
      dog: string;
      cat: string;
      bird: string;
      other: string;
    };
  };
};

type FormState = {
  name: string;
  type: string;
  email: string;
  phone: string;
  city: string;
  rawLocation: string;
  latitude: string;
  longitude: string;
  description: string;
};

const initialState: FormState = {
  name: "",
  type: "cat",
  email: "",
  phone: "",
  city: "",
  rawLocation: "",
  latitude: "44.426800",
  longitude: "26.102500",
  description: "",
};

export default function ReportForm({ lang, labels }: ReportFormProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdPet, setCreatedPet] = useState<null | {
    id: number;
    name: string;
    city: string | null;
  }>(null);

  const typeOptions = useMemo(
    () => [
      { value: "cat", label: labels.types.cat },
      { value: "dog", label: labels.types.dog },
      { value: "bird", label: labels.types.bird },
      { value: "other", label: labels.types.other },
    ],
    [labels.types]
  );

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setCreatedPet(null);

    const payload = new FormData();
    payload.set("name", form.name.trim());
    payload.set("type", form.type);
    payload.set("email", form.email.trim());
    payload.set("latitude", form.latitude);
    payload.set("longitude", form.longitude);

    if (form.phone.trim()) payload.set("phone", form.phone.trim());
    if (form.city.trim()) payload.set("city", form.city.trim());
    if (form.rawLocation.trim()) payload.set("rawLocation", form.rawLocation.trim());
    if (form.description.trim()) payload.set("description", form.description.trim());

    photos.forEach((photo) => {
      payload.append("photos", photo);
    });

    try {
      const response = await fetch("/api/lost-pets", {
        method: "POST",
        body: payload,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.message ?? "Could not create listing.");
        return;
      }

      setCreatedPet({
        id: data.id,
        name: data.name,
        city: data.city ?? null,
      });
      setForm(initialState);
      setPhotos([]);
      setUploadResetKey((current) => current + 1);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not create listing."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-warm-texture text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
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

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <ReportLocationPicker
            addressLabel={labels.map.locationLabel}
            addressPlaceholder={labels.map.locationPlaceholder}
            locateLabel={labels.map.locate}
            locatingLabel={labels.map.locating}
            locationDenied={labels.map.denied}
            locationHint={labels.map.hint}
            eyebrow={labels.ui.mapEyebrow}
            title={labels.ui.mapTitle}
            badge={labels.ui.mapBadge}
            onLocationChange={(next) => {
              setForm((current) => ({
                ...current,
                rawLocation: next.label || current.rawLocation,
                city: next.city || current.city,
                latitude:
                  typeof next.latitude === "number"
                    ? next.latitude.toFixed(6)
                    : current.latitude,
                longitude:
                  typeof next.longitude === "number"
                    ? next.longitude.toFixed(6)
                    : current.longitude,
              }));
            }}
          />

          <aside className="grid gap-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_38px_-28px_rgba(15,23,42,0.36)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {labels.ui.quickStatus}
              </p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                    {labels.ui.lastSeenArea}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {form.rawLocation || labels.map.locationPlaceholder}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {labels.fields.city}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {form.city || labels.ui.cityAuto}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {labels.fields.photos}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {photos.length} / 4 {labels.ui.photosSelected}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {labels.fields.latitude}: {form.latitude}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {labels.fields.longitude}: {form.longitude}
                </span>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50/85 p-5 shadow-[0_18px_34px_-26px_rgba(16,185,129,0.35)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900">
                {labels.successTitle}
              </p>
              {createdPet ? (
                <div className="mt-3 space-y-3 text-sm text-emerald-950">
                  <p>
                    {labels.successBody} <strong>#{createdPet.id}</strong>
                  </p>
                  <p>
                    {createdPet.name}
                    {createdPet.city ? ` · ${createdPet.city}` : ""}
                  </p>
                  <Link
                    href={`/api/lost-pets/${createdPet.id}`}
                    target="_blank"
                    className="inline-block font-semibold underline decoration-2 underline-offset-4"
                  >
                    {labels.viewApi}
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-sm text-emerald-900/80">
                  {labels.ui.draftHint}
                </p>
              )}
            </div>
          </aside>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[1.75rem] border border-slate-200 bg-white/85 p-6 shadow-[0_22px_38px_-28px_rgba(31,41,55,0.4)]"
          >
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
                {labels.ui.flowIdentity}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                {labels.ui.flowContact}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                {labels.ui.flowPhotos}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={labels.fields.name} name="name">
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder={labels.placeholders.name}
                />
              </FormField>

              <FormField label={labels.fields.type} name="type">
                <Select
                  id="type"
                  value={form.type}
                  onChange={(event) => updateField("type", event.target.value)}
                  options={typeOptions}
                  placeholder={labels.placeholders.petType}
                />
              </FormField>

              <FormField label={labels.fields.email} name="email">
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder={labels.placeholders.email}
                />
              </FormField>

              <FormField label={labels.fields.phone} name="phone">
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder={labels.placeholders.phone}
                />
              </FormField>

              <FormField label={labels.fields.city} name="city">
                <Input
                  id="city"
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  placeholder={labels.placeholders.city}
                />
              </FormField>

              <FormField label={labels.fields.location} name="rawLocation">
                <Input
                  id="rawLocation"
                  value={form.rawLocation}
                  onChange={(event) =>
                    updateField("rawLocation", event.target.value)
                  }
                  placeholder={labels.placeholders.location}
                />
              </FormField>
            </div>

            <input type="hidden" name="latitude" value={form.latitude} />
            <input type="hidden" name="longitude" value={form.longitude} />

            <div className="mt-4 grid gap-4">
              <FormField label={labels.fields.description} name="description">
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  placeholder={labels.placeholders.description}
                  rows={4}
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-0 hover:border-gray-400"
                />
              </FormField>

              <FormField label={labels.fields.photos} name="photos">
                <div className="space-y-2">
                  <FileUpload
                    key={uploadResetKey}
                    id="photos"
                    name="photos"
                    maxFiles={4}
                    showPreview
                    onChange={(event) => {
                      const selectedFiles = event.target.files
                        ? Array.from(event.target.files)
                        : [];
                      setPhotos(selectedFiles);
                    }}
                  />
                  <p className="text-xs text-slate-500">
                    {labels.placeholders.photos}
                  </p>
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
              buttonType="peach"
              className="mt-6"
              innerClassName="w-full px-8 sm:w-auto"
              disabled={submitting}
            >
              {submitting ? labels.submitting : labels.submit}
            </Button>
          </form>

          <aside className="space-y-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white/85 p-5 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {labels.ui.apiTitle}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                This slice creates a real listing and returns it from the API.
                Uploaded photos are stored locally and the same files can be
                passed to the AI service by file path in the next slice.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,250,245,0.9),rgba(255,255,255,0.95))] p-5 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {labels.ui.visualCheck}
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <p>{labels.ui.visualLineOne}</p>
                <p>{labels.ui.visualLineTwo}</p>
                <p>{labels.ui.visualLineThree}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
