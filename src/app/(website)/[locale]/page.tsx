import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/dictionaries";
import {publicMetadata} from "@/features/website/seo";
import { PublicScreen } from "@/features/website/public-screen";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <PublicScreen locale={locale} page="home" />;
}

export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(!isLocale(locale))notFound();return publicMetadata(locale,"home");}
