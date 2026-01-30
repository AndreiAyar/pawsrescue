import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LinkButton } from "@repo/ui/linkButton";

const clusterDots = [
  { top: "18%", left: "22%", size: 16, opacity: 0.7 },
  { top: "30%", left: "55%", size: 22, opacity: 0.8 },
  { top: "42%", left: "35%", size: 10, opacity: 0.6 },
  { top: "58%", left: "18%", size: 14, opacity: 0.6 },
  { top: "66%", left: "48%", size: 20, opacity: 0.75 },
  { top: "30%", left: "78%", size: 12, opacity: 0.7 },
  { top: "54%", left: "78%", size: 18, opacity: 0.8 },
  { top: "74%", left: "68%", size: 10, opacity: 0.6 },
];

type RecentItem = {
  name: string;
  city: string;
  type: string;
  time: string;
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "Home" });
  const messages = (await import(`../../messages/${lang}.json`)).default;

  const recentItems = (messages as { Home?: { recentItems?: RecentItem[] } })
    ?.Home?.recentItems ?? [];

  return (
    <main className="min-h-screen bg-[#f3f0e8] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href={`/${lang}`} className="flex items-center gap-2 text-lg font-black">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 shadow-[0_6px_12px_-8px_rgba(0,0,0,0.35)]">
              <PawIcon className="h-5 w-5 text-amber-700" />
            </span>
            <span className="font-display">PawsRescue</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href={`/${lang}/search`}
              className="underline decoration-2 underline-offset-4"
            >
              {t("nav.search")}
            </Link>
            <Link
              href={`/${lang}/report`}
              className="underline decoration-2 underline-offset-4"
            >
              {t("nav.report")}
            </Link>
            <Link
              href={`/${lang}/scan`}
              className="underline decoration-2 underline-offset-4"
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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white">
                <CatFaceIcon className="h-4 w-4 text-amber-700" />
              </span>
              {t("hero.kicker")}
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="mt-4 text-lg text-slate-700">{t("hero.body")}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <LinkButton href={`/${lang}/report`} variant="main">
                {t("cta.report")}
              </LinkButton>
              <LinkButton href={`/${lang}/scan`} variant="secondary">
                {t("cta.scan")}
              </LinkButton>
              <Link
                href={`/${lang}/search`}
                className="text-sm font-semibold underline decoration-2 underline-offset-4"
              >
                {t("cta.browse")}
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white/70 p-4 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.45)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("stats.active")}
                </p>
                <p className="mt-2 text-2xl font-black">1,284</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/70 p-4 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.45)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("stats.matches")}
                </p>
                <p className="mt-2 text-2xl font-black">163</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/70 p-4 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.45)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("stats.cities")}
                </p>
                <p className="mt-2 text-2xl font-black">12</p>
              </div>
            </div>
          </div>

          <Link href={`/${lang}/search`} className="group block">
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_60px_-40px_rgba(0,0,0,0.35)]">
              <div className="relative aspect-[16/10]">
                <Image
                  src="/map-preview.svg"
                  alt={t("map.label")}
                  fill
                  className="object-cover"
                  priority
                />
                {clusterDots.map((dot, index) => (
                  <span
                    key={`${dot.top}-${dot.left}-${index}`}
                    className="absolute rounded-full bg-amber-500/70 shadow-[0_0_0_6px_rgba(245,158,11,0.18)]"
                    style={{
                      top: dot.top,
                      left: dot.left,
                      width: dot.size,
                      height: dot.size,
                      opacity: dot.opacity,
                    }}
                  />
                ))}
              </div>
              <div className="absolute inset-x-4 bottom-4 rounded-lg border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
                {t("map.badge")}
              </div>
            </div>
          </Link>
        </section>

        <section className="mt-14 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">{t("recent.title")}</h2>
              <Link
                href={`/${lang}/search`}
                className="text-sm font-semibold underline decoration-2 underline-offset-4"
              >
                {t("recent.viewAll")}
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {recentItems.map((item) => (
                <div
                  key={`${item.name}-${item.city}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/70 px-4 py-3 shadow-[0_14px_24px_-22px_rgba(0,0,0,0.4)]"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.type} · {item.city}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase text-amber-700">
                    <PawIcon className="h-3 w-3" />
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/70 p-6">
            <h2 className="font-display text-2xl font-bold">{t("how.title")}</h2>
            <div className="mt-4 grid gap-4 text-sm text-slate-700">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    1
                  </span>
                  {t("how.oneTitle")}
                </p>
                <p className="mt-1">{t("how.oneBody")}</p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    2
                  </span>
                  {t("how.twoTitle")}
                </p>
                <p className="mt-1">{t("how.twoBody")}</p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    3
                  </span>
                  {t("how.threeTitle")}
                </p>
                <p className="mt-1">{t("how.threeBody")}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
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

function CatFaceIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 10.5 3 6.2c-.3-.8.6-1.6 1.4-1.3l4 1.7a7.4 7.4 0 0 1 7.2 0l4-1.7c.8-.3 1.7.5 1.4 1.3l-1.5 4.3" />
      <path d="M6 12.5a6 6 0 0 0 12 0" />
      <path d="M9.5 14.2h.01M14.5 14.2h.01" />
      <path d="M10.5 16.4c.5.4 1 .6 1.5.6s1-.2 1.5-.6" />
    </svg>
  );
}
