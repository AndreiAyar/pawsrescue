import Link from "next/link";
import { getTranslations } from "next-intl/server";

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
  embeddingInfo: {
    model: string;
    fallbackUsed: boolean;
    warning: string | null;
  } | null;
};

export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = await getTranslations({ locale: lang, namespace: "Common" });
  const response = await fetch(
    `${process.env.API_URL ?? "http://localhost:3015"}/lost-pets/${id}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
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
          <p className="mt-3 text-slate-700">Listing not found.</p>
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

            {pet.imageUrls[0] ? (
              <img
                src={pet.imageUrls[0]}
                alt={pet.name}
                className="mt-5 h-72 w-full rounded-2xl object-cover"
              />
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

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("embedding.title")}
              </p>
              {pet.embeddingInfo ? (
                <div className="mt-2 space-y-1">
                  <p>
                    <span className="font-semibold">{t("embedding.model")}:</span>{" "}
                    {pet.embeddingInfo.model}
                  </p>
                  <p>
                    <span className="font-semibold">{t("embedding.fallback")}:</span>{" "}
                    {pet.embeddingInfo.fallbackUsed
                      ? t("embedding.yes")
                      : t("embedding.no")}
                  </p>
                  {pet.embeddingInfo.warning ? (
                    <p className="text-amber-700">
                      <span className="font-semibold">
                        {t("embedding.warning")}:
                      </span>{" "}
                      {pet.embeddingInfo.warning}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-slate-600">{t("embedding.missing")}</p>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {pet.description ?? "No description yet."}
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
