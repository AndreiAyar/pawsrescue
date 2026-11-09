import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LinkButton } from "@repo/ui/linkButton";
import MapView from "../components/Map/Map";

type LostPet = {
  id: number;
  name: string;
  city: string | null;
  type: string;
  createdAt: string;
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "Home" });
  let pets: LostPet[] = [];

  try {
    const response = await fetch(
      `${process.env.API_URL ?? "http://localhost:3015"}/lost-pets`,
      { cache: "no-store" },
    );

    if (response.ok) {
      pets = (await response.json()) as LostPet[];
    }
  } catch {
    pets = [];
  }

  const cities = new Set(
    pets.map((pet) => pet.city?.trim()).filter((city): city is string => Boolean(city)),
  ).size;
  const recentPets = pets.slice(0, 3);

  return (
    <main className="min-h-screen bg-warm-texture text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/${lang}`}
            className="flex items-center gap-2 text-lg font-black"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 shadow-[0_6px_12px_-8px_rgba(0,0,0,0.35)]">
              <PawIcon className="h-5 w-5 text-amber-700" />
            </span>
            <span className="font-display">PawsRescue</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href={`/${lang}/search`}
              className="text-slate-600 underline decoration-2 underline-offset-4 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3f0e8]"
            >
              {t("nav.search")}
            </Link>
            <Link
              href={`/${lang}/report`}
              className="rounded-full bg-[color:var(--peach)] px-3 py-1 font-semibold text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3f0e8]"
            >
              {t("nav.report")}
            </Link>
            <Link
              href={`/${lang}/scan`}
              className="text-slate-600 underline decoration-2 underline-offset-4 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3f0e8]"
            >
              {t("nav.scan")}
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <Link
                href="/ro"
                className={lang === "ro" ? "text-slate-900" : "text-slate-500"}
              >
                RO
              </Link>
              <span className="h-3 w-px bg-slate-300" />
              <Link
                href="/en"
                className={lang === "en" ? "text-slate-900" : "text-slate-500"}
              >
                EN
              </Link>
            </div>
          </nav>
        </header>

        <section className="mt-10 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="mt-4 text-lg text-slate-700">{t("hero.body")}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <LinkButton
                href={`/${lang}/report`}
                variant="main"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3f0e8]"
              >
                {t("cta.report")}
              </LinkButton>
              <LinkButton
                href={`/${lang}/scan`}
                variant="secondary"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3f0e8]"
              >
                {t("cta.scan")}
              </LinkButton>
              <Link
                href={`/${lang}/search`}
                className="text-sm font-semibold underline decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3f0e8]"
              >
                {t("cta.browse")}
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-white/80 p-4 shadow-[0_12px_26px_-22px_rgba(31,41,55,0.35)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("stats.reports")}
                </p>
                <p className="mt-2 text-2xl font-black">{pets.length}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white/80 p-4 shadow-[0_12px_26px_-22px_rgba(31,41,55,0.35)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("stats.cities")}
                </p>
                <p className="mt-2 text-2xl font-black">{cities}</p>
              </div>
            </div>
          </div>

          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_26px_70px_-38px_rgba(31,41,55,0.45)]">
            <MapView
              showLocateButton={false}
              showSearchControl={false}
              maxReverseGeocodeRequests={0}
              listingHrefBase={`/${lang}/pets`}
              openListingLabel={t("map.openListing")}
            />
            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-end">
              <Link
                href={`/${lang}/search`}
                className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg ring-1 ring-slate-200 transition hover:bg-amber-50"
              >
                {t("map.badge")}
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">
                {t("recent.title")}
              </h2>
              <Link
                href={`/${lang}/search`}
                className="text-sm font-semibold underline decoration-2 underline-offset-4"
              >
                {t("recent.viewAll")}
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {recentPets.length ? (
                recentPets.map((pet) => (
                  <Link
                    key={pet.id}
                    href={`/${lang}/pets/${pet.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/75 px-4 py-3 shadow-[0_12px_24px_-20px_rgba(31,41,55,0.35)] transition hover:border-amber-200 hover:bg-amber-50/70"
                  >
                    <div>
                      <p className="text-sm font-semibold">{pet.name}</p>
                      <p className="text-xs text-slate-500">
                        {pet.type}
                        {pet.city ? ` · ${pet.city}` : ""}
                      </p>
                    </div>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--butter)] text-amber-700">
                      <PawIcon className="h-4 w-4" />
                    </span>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white/75 px-4 py-5 text-sm text-slate-600">
                  {t("recent.empty")}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/75 p-6 shadow-[0_18px_30px_-26px_rgba(31,41,55,0.4)]">
            <h2 className="font-display text-2xl font-bold">{t("how.title")}</h2>
            <div className="mt-5 grid gap-5 text-sm text-slate-700">
              <HomeStep number="1" tone="mint" title={t("how.oneTitle")}>
                {t("how.oneBody")}
              </HomeStep>
              <HomeStep number="2" tone="peach" title={t("how.twoTitle")}>
                {t("how.twoBody")}
              </HomeStep>
              <HomeStep number="3" tone="butter" title={t("how.threeTitle")}>
                {t("how.threeBody")}
              </HomeStep>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function HomeStep({
  number,
  tone,
  title,
  children,
}: {
  number: string;
  tone: "mint" | "peach" | "butter";
  title: string;
  children: React.ReactNode;
}) {
  const toneClass = {
    mint: "bg-[color:var(--mint)] text-emerald-800",
    peach: "bg-[color:var(--peach)] text-amber-800",
    butter: "bg-[color:var(--butter)] text-amber-800",
  }[tone];

  return (
    <div className="grid grid-cols-[2rem_1fr] gap-3">
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold ${toneClass}`}
      >
        {number}
      </span>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-1 leading-6">{children}</p>
      </div>
    </div>
  );
}

function PawIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.6 11.2c-1.2 0-2.2-1.3-2.2-2.9S5.4 5.4 6.6 5.4s2.2 1.3 2.2 2.9-1 2.9-2.2 2.9Zm10.8 0c-1.2 0-2.2-1.3-2.2-2.9s1-2.9 2.2-2.9 2.2 1.3 2.2 2.9-1 2.9-2.2 2.9ZM9.4 9.8c-1.1 0-2-1.1-2-2.6S8.3 4.6 9.4 4.6s2 1.1 2 2.6-0.9 2.6-2 2.6Zm5.2 0c-1.1 0-2-1.1-2-2.6s0.9-2.6 2-2.6 2 1.1 2 2.6-0.9 2.6-2 2.6Zm-2.6 10.2c-2.8 0-5.3-1.4-5.3-3.7 0-1.8 1.4-3.2 3.2-3.8 0.8-0.3 1.4-0.4 2.1-0.4s1.3 0.1 2.1 0.4c1.8 0.6 3.2 2 3.2 3.8 0 2.3-2.5 3.7-5.3 3.7Z" />
    </svg>
  );
}
