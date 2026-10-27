import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { dictionaries, isLocale, locales } from "@/i18n/dictionaries";
import { PublicShell } from "@/components/public/public-shell";
import "@/styles/globals.css";
import "@/styles/website.css";

export const dynamicParams = false;
export function generateStaticParams() { return locales.map(locale => ({ locale })); }
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return {
    title: { default: dictionaries[locale].nav.home, template: "%s | Fitimi Construction" },
    description: dictionaries[locale].pages.home.description,
    robots: { index: false, follow: false },
  };
}

export default async function WebsiteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <html lang={locale}><body><PublicShell locale={locale}>{children}</PublicShell></body></html>;
}
