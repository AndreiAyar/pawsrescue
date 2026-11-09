import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ImageLightbox } from "@repo/ui/imageLightbox";
import PetLocationMap from "./PetLocationMap";

type PetDetail = {
  id: number;
  name: string;
  type: string;
  email: string;
  phone: string | null;
  description: string | null;
  city: string | null;
  rawLocation: string | null;
  latitude: number;
  longitude: number;
  imageUrls: string[];
};

function getPetImageUrl(imageUrl?: string | null) {
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

export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = await getTranslations({ locale: lang, namespace: "Common" });
  let response: Response | null = null;

  try {
    response = await fetch(
      `${process.env.API_URL ?? "http://localhost:3015"}/lost-pets/${id}`,
      { cache: "no-store" },
    );
  } catch {
    response = null;
  }

  if (!response?.ok) {
    return (
      <main className="min-h-screen bg-warm-texture px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-4xl">
          <Link
            href={`/${lang}/search`}
            className="text-sm font-semibold underline decoration-2 underline-offset-4"
          >
            {t("backHome")}
          </Link>
          <h1 className="mt-4 font-display text-3xl font-black">
            {t("titles.petDetails")} · #{id}
          </h1>
          <p className="mt-3 text-slate-700">
            {response ? t("listingNotFound") : t("apiUnavailable")}
          </p>
        </div>
      </main>
    );
  }

  const pet = (await response.json()) as PetDetail;

  return (
    <main className="min-h-screen bg-warm-texture text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href={`/${lang}/search`}
          className="text-sm font-semibold underline decoration-2 underline-offset-4"
        >
          {t("backHome")}
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]">
            <h1 className="font-display text-3xl font-black">
              {pet.name} <span className="text-slate-400">#{pet.id}</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {pet.type} {pet.city ? `· ${pet.city}` : ""}
            </p>

            {pet.imageUrls.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {pet.imageUrls.map((imageUrl, index) => {
                  const src = getPetImageUrl(imageUrl);
                  return src ? (
                    <ImageLightbox
                      key={`${imageUrl}-${index}`}
                      src={src}
                      alt={`${pet.name} - photo ${index + 1}`}
                      buttonClassName={`w-full rounded-2xl bg-slate-100 ${index === 0 ? "h-72 sm:col-span-2" : "h-48"}`}
                      className="h-full w-full object-contain"
                    />
                  ) : null;
                })}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </p>
                <p className="mt-1">{pet.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </p>
                <p className="mt-1">{pet.phone ?? "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Coordinates
                </p>
                <p className="mt-1">
                  {pet.latitude}, {pet.longitude}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location note
                </p>
                <p className="mt-1">{pet.rawLocation ?? "Not provided"}</p>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)] sm:p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("lastSeenLocation")}
              </h2>
              <p className="mb-4 mt-2 text-sm font-semibold text-slate-900">
                {pet.name}
                {pet.city ? ` · ${pet.city}` : ""}
              </p>
              <PetLocationMap
                latitude={pet.latitude}
                longitude={pet.longitude}
                name={pet.name}
              />
              {pet.rawLocation ? (
                <p className="mt-3 text-sm text-slate-600">{pet.rawLocation}</p>
              ) : null}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {pet.description ?? "No description yet."}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
