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
  const search = await getTranslations({ locale: lang, namespace: "Search" });

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
        map: {
          locationLabel: search("location.label"),
          locationPlaceholder: search("location.placeholder"),
          locate: search("location.locate"),
          locating: search("location.locating"),
          denied: search("location.denied"),
          hint: search("location.hint"),
        },
        ui: {
          mapEyebrow: t("ui.mapEyebrow"),
          mapTitle: t("ui.mapTitle"),
          mapBadge: t("ui.mapBadge"),
          quickStatus: t("ui.quickStatus"),
          lastSeenArea: t("ui.lastSeenArea"),
          cityAuto: t("ui.cityAuto"),
          photosSelected: t("ui.photosSelected"),
          draftHint: t("ui.draftHint"),
          flowIdentity: t("ui.flowIdentity"),
          flowContact: t("ui.flowContact"),
          flowPhotos: t("ui.flowPhotos"),
          apiTitle: t("ui.apiTitle"),
          visualCheck: t("ui.visualCheck"),
          visualLineOne: t("ui.visualLineOne"),
          visualLineTwo: t("ui.visualLineTwo"),
          visualLineThree: t("ui.visualLineThree"),
        },
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
          photos: t("fields.photos"),
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
          petType: t("placeholders.petType"),
          photos: t("placeholders.photos"),
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
