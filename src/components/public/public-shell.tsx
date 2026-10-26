import Link from "next/link";
import type { ReactNode } from "react";
import { DesktopNavigation, MobileNavigation } from "@/components/layout/navigation";
import { dictionaries, publicNavigation, type Locale } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./language-switcher";

export function PublicShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const copy = dictionaries[locale];
  const items = publicNavigation(locale);
  return <div className="public-layout">
    <a className="skip-link" href="#main-content">{copy.skip}</a>
    <header className="public-header"><div className="public-header-inner">
      <Link className="wordmark" href={`/${locale}`}>Construction<span>{copy.brandNote}</span></Link>
      <DesktopNavigation items={items} label={copy.navigation} className="public-links" />
      <div className="header-controls"><LanguageSwitcher locale={locale} /><MobileNavigation items={items} label={copy.navigation} openLabel={copy.menu} closeLabel={copy.close} /></div>
    </div></header>
    <main id="main-content">{children}</main>
    <footer className="public-footer"><div className="public-container footer-inner"><div><Link href={`/${locale}`} className="wordmark">Construction<span>{copy.brandNote}</span></Link><p className="muted">{copy.footer}</p></div>
      <nav aria-label={locale === "sq" ? "Navigimi në fund të faqes" : "Footer navigation"}>{items.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
    </div></footer>
  </div>;
}
