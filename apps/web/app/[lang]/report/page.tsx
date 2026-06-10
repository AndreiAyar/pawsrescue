import { getTranslations } from "next-intl/server";
import ReportForm from "./ReportForm";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "Report" });
  const common = await getTranslations({ locale: lang, namespace: "Common" });

  return (
    <ReportForm
      lang={lang}
      labels={{
        title: t("title"),
        intro: t("intro"),
        backHome: common("backHome"),
        successTitle: t("successTitle"),
        successBody: t("successBody"),
        viewApi: t("viewApi"),
        submit: t("submit"),
        submitting: t("submitting"),
        fields: {
          name: t("fields.name"),
          type: t("fields.type"),
          email: t("fields.email"),
          phone: t("fields.phone"),
          city: t("fields.city"),
          location: t("fields.location"),
          latitude: t("fields.latitude"),
          longitude: t("fields.longitude"),
          description: t("fields.description"),
          imageUrls: t("fields.imageUrls"),
        },
        placeholders: {
          name: t("placeholders.name"),
          email: t("placeholders.email"),
          phone: t("placeholders.phone"),
          city: t("placeholders.city"),
          location: t("placeholders.location"),
          latitude: t("placeholders.latitude"),
          longitude: t("placeholders.longitude"),
          description: t("placeholders.description"),
          imageUrls: t("placeholders.imageUrls"),
          petType: t("placeholders.petType"),
        },
        types: {
          dog: t("types.dog"),
          cat: t("types.cat"),
          bird: t("types.bird"),
          other: t("types.other"),
        },
      }}
    />
  );
}
