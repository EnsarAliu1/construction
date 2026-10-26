"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/i18n/dictionaries";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const suffix = pathname.split("/").slice(2).join("/");
  return <nav className="language-switcher" aria-label={locale === "sq" ? "Gjuha" : "Language"}>
    {locales.map(value => <Link key={value} href={`/${value}${suffix ? `/${suffix}` : ""}`} lang={value} hrefLang={value}
      aria-label={value === "sq" ? "Shqip" : "English"} aria-current={locale === value ? "true" : undefined}>
      {value.toUpperCase()}
    </Link>)}
  </nav>;
}
