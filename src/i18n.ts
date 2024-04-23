import {notFound} from "next/navigation";
import {getRequestConfig} from "next-intl/server";

// Can be imported from a shared config
const locales = ["ru", "uz"];

export default getRequestConfig(async ({locale}) => {
  const baseLocal = new Intl.Locale(locale).baseName;
  if (!locales.includes(baseLocal)) notFound();

  return {
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
