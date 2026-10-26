import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/dictionaries";
import { PublicScreen } from "@/features/website/public-screen";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <PublicScreen locale={locale} page="home" />;
}
