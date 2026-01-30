import Link from "next/link";
import { getTranslations } from "next-intl/server";
import SearchMapPanel from "./SearchMapPanel";

type RecentItem = {
  name: string;
  city: string;
  type: string;
  time: string;
};

export default async function SearchPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "Common" });
  const s = await getTranslations({ locale: lang, namespace: "Search" });
  const title = t("titles.search");
  const messages = (await import(`../../../messages/${lang}.json`)).default;
  const recentItems = (messages as { Home?: { recentItems?: RecentItem[] } })
    ?.Home?.recentItems ?? [];

  return (
    <main className="min-h-screen bg-warm-texture text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              {s("eyebrow")}
            </p>
            <h1 className="font-display text-3xl font-black sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
              {s("subhead")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 sm:inline-flex">
              {s("live")}
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <Link
              href={`/${lang}`}
              className="text-sm font-semibold underline decoration-2 underline-offset-4"
            >
              {t("backHome")}
            </Link>
          </div>
        </header>

        <section className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.4)]">
            {s("filters.label")}
          </span>
          {[
            s("filters.city"),
            s("filters.type"),
            s("filters.color"),
            s("filters.status"),
            s("filters.radius"),
          ].map((label) => (
            <button
              key={label}
              type="button"
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100"
            >
              {label}
            </button>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <SearchMapPanel
              title={s("map.title")}
              badge={s("map.badge")}
              locateLabel={s("location.locate")}
              locatingLabel={s("location.locating")}
              locationLabel={s("location.label")}
              locationPlaceholder={s("location.placeholder")}
              locationDenied={s("location.denied")}
              locationHint={s("location.hint")}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm shadow-[0_16px_28px_-24px_rgba(31,41,55,0.4)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {s("legend.title")}
                </p>
                <div className="mt-3 space-y-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#51bbd6]" />
                    {s("legend.small")}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#f1f075]" />
                    {s("legend.medium")}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#f28cb1]" />
                    {s("legend.large")}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm shadow-[0_16px_28px_-24px_rgba(16,185,129,0.35)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
                  {s("alerts.title")}
                </p>
                <p className="mt-2 text-sm text-emerald-900/80">
                  {s("alerts.body")}
                </p>
                <button
                  type="button"
                  className="mt-3 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700"
                >
                  {s("alerts.cta")}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {s("detail.title")}
              </p>
              <p className="mt-2 text-sm text-slate-700">{s("detail.body")}</p>
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-xs text-slate-500">
                {s("detail.placeholder")}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">
                  {s("list.title")}
                </h2>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  {s("list.badge")}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {recentItems.map((item) => (
                  <button
                    key={`${item.name}-${item.city}`}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-left shadow-[0_12px_22px_-18px_rgba(31,41,55,0.35)] transition hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50/60"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.type} · {item.city}
                      </p>
                    </div>
                    <span className="rounded-full bg-[color:var(--butter)] px-3 py-1 text-xs font-semibold uppercase text-amber-700">
                      {item.time}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"
              >
                {s("list.more")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
