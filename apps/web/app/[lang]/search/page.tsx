import Link from "next/link";
import { getTranslations } from "next-intl/server";
import MapClient from "./MapClient";

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
          <MapClient />
        </section>
      </div>
    </main>
  );
}
