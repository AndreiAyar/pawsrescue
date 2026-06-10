import { getTranslations } from "next-intl/server";
import ScanForm from "./ScanForm";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "Scan" });
  const common = await getTranslations({ locale: lang, namespace: "Common" });

  return (
    <ScanForm
      lang={lang}
      labels={{
        title: t("title"),
        intro: t("intro"),
        backHome: common("backHome"),
        cityLabel: t("cityLabel"),
        cityPlaceholder: t("cityPlaceholder"),
        photosLabel: t("photosLabel"),
        photosHint: t("photosHint"),
        submit: t("submit"),
        submitting: t("submitting"),
        empty: t("empty"),
        resultsTitle: t("resultsTitle"),
        openListing: t("openListing"),
      }}
    />
  );
}
