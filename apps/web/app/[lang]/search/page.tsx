import Link from "next/link";
import dynamic from "next/dynamic";
import { getTranslations } from "next-intl/server";

const Map = dynamic(() => import("../../components/Map/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/70 text-sm font-semibold text-slate-600 shadow-[0_18px_30px_-26px_rgba(31,41,55,0.4)]">
      Loading map...
    </div>
  ),
});

export default async function SearchPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "Common" });
  const title = t("titles.search");

  return (
    <main className="min-h-screen bg-[#f3f0e8] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              {title}
            </p>
            <h1 className="font-display text-3xl font-black">{title}</h1>
          </div>
          <Link
            href={`/${lang}`}
            className="text-sm font-semibold underline decoration-2 underline-offset-4"
          >
            {t("backHome")}
          </Link>
        </header>

        <section className="mt-6">
          <Map />
        </section>
      </div>
    </main>
  );
}
