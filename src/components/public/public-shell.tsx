import {PublicFooter} from "./public-footer";
import {PublicHeader} from "./public-header";
import Link from "next/link";
import Image from "next/image";
import type {ReactNode} from "react";
import {DesktopNavigation} from "@/components/layout/navigation";
import {dictionaries,publicNavigation,type Locale} from "@/i18n/dictionaries";
import {PublicMobileMenu} from "./mobile-menu";
import {LogoFilters} from "./logo-filters";
export function PublicShell({locale,children}:{locale:Locale;children:ReactNode}){const c=dictionaries[locale],items=publicNavigation(locale),headerItems=[...items.slice(1,-1),{href:`/${locale}#procesi`,label:"Procesi"},items[items.length-1]];return <div className="public-layout"><LogoFilters/><a className="skip-link" href="#main-content">{c.skip}</a><PublicHeader><div className="public-header-inner"><Link className="site-logo" href={`/${locale}`} aria-label="Fitimi Construction"><Image src="/logos/fitimi-clean.png" width={2004} height={785} alt="Fitimi Construction" preload sizes="185px"/></Link><DesktopNavigation items={headerItems} label={c.navigation} className="public-links"/><div className="header-controls"><Link className="header-quote" href={`/${locale}#kontakti`}>Kërko ofertë</Link><PublicMobileMenu items={headerItems} label={c.navigation} openLabel={c.menu} closeLabel={c.close}/></div></div></PublicHeader><main id="main-content" tabIndex={-1}>{children}</main><PublicFooter items={headerItems}/></div>;}
