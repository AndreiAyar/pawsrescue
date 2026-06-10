"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { FormField } from "@repo/ui/formField";
import { Input } from "@repo/ui/input";
import { Select } from "@repo/ui/select";

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
      imageUrls: string;
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
      imageUrls: string;
      petType: string;
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
  imageUrls: string;
};

const initialState: FormState = {
  name: "",
  type: "cat",
  email: "",
  phone: "",
  city: "",
  rawLocation: "",
  latitude: "44.4268",
  longitude: "26.1025",
  description: "",
  imageUrls: "",
};

export default function ReportForm({ lang, labels }: ReportFormProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
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

    const payload = {
      name: form.name.trim(),
      type: form.type,
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      city: form.city.trim() || undefined,
      rawLocation: form.rawLocation.trim() || undefined,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      description: form.description.trim() || undefined,
      imageUrls: form.imageUrls
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch("/api/lost-pets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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
      <div className="mx-auto max-w-4xl px-6 py-12">
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

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]"
          >
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

              <FormField label={labels.fields.latitude} name="latitude">
                <Input
                  id="latitude"
                  type="number"
                  step="0.000001"
                  value={form.latitude}
                  onChange={(event) =>
                    updateField("latitude", event.target.value)
                  }
                  placeholder={labels.placeholders.latitude}
                />
              </FormField>

              <FormField label={labels.fields.longitude} name="longitude">
                <Input
                  id="longitude"
                  type="number"
                  step="0.000001"
                  value={form.longitude}
                  onChange={(event) =>
                    updateField("longitude", event.target.value)
                  }
                  placeholder={labels.placeholders.longitude}
                />
              </FormField>
            </div>

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
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-0 hover:border-gray-400"
                />
              </FormField>

              <FormField label={labels.fields.imageUrls} name="imageUrls">
                <textarea
                  id="imageUrls"
                  value={form.imageUrls}
                  onChange={(event) =>
                    updateField("imageUrls", event.target.value)
                  }
                  placeholder={labels.placeholders.imageUrls}
                  rows={4}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-0 hover:border-gray-400"
                />
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
              innerClassName="w-full sm:w-auto"
              disabled={submitting}
            >
              {submitting ? labels.submitting : labels.submit}
            </Button>
          </form>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                API
              </p>
              <p className="mt-2 text-sm text-slate-700">
                This slice creates a real listing and returns it from the API.
                Image URLs are accepted as plain text for now to keep the flow
                simple.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-[0_18px_30px_-24px_rgba(16,185,129,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
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
                  Create a listing and the new record will appear here.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
