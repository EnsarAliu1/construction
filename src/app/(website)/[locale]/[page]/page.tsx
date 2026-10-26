import { notFound } from "next/navigation";
import { dictionaries, isLocale, isPublicPage, publicPages } from "@/i18n/dictionaries";
import { PublicScreen } from "@/features/website/public-screen";

export const dynamicParams = false;
export function generateStaticParams() { return publicPages.map(page => ({ page })); }
type Props = { params: Promise<{ locale: string; page: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale, page } = await params;
  if (!isLocale(locale) || !isPublicPage(page)) notFound();
  const content = dictionaries[locale].pages[page];
  return { title: content.title, description: content.description };
}
export default async function WebsitePage({ params }: Props) {
  const { locale, page } = await params;
  if (!isLocale(locale) || !isPublicPage(page)) notFound();
  return <PublicScreen locale={locale} page={page} />;
}
