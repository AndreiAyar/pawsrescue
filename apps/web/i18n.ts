import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = locale ?? "ro";
  return {
    locale: resolvedLocale,
    messages: (await import(`./messages/${resolvedLocale}.json`)).default,
  };
});
