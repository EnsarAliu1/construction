import { notFound } from "next/navigation";
import { isLocale, isPublicPage, publicPages } from "@/i18n/dictionaries";
import {publicMetadata} from "@/features/website/seo";
import { PublicScreen } from "@/features/website/public-screen";

export const dynamicParams = false;
export function generateStaticParams() { return publicPages.map(page => ({ page })); }
type Props = { params: Promise<{ locale: string; page: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale, page } = await params;
  if (!isLocale(locale) || !isPublicPage(page)) notFound();
  return publicMetadata(locale,page);
}
export default async function WebsitePage({ params }: Props) {
  const { locale, page } = await params;
  if (!isLocale(locale) || !isPublicPage(page)) notFound();
  return <PublicScreen locale={locale} page={page} />;
}
