import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = await getTranslations({ locale: lang, namespace: "Common" });
  const title = t("titles.petDetails");

  return (
    <main className="min-h-screen bg-[#f3f0e8] text-slate-900">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-black">
          {title} · #{id}
        </h1>
        <p className="mt-3 text-slate-700">{t("comingSoon")}</p>
        <Link
          href={`/${lang}`}
          className="mt-6 inline-block text-sm font-semibold underline decoration-2 underline-offset-4"
        >
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
