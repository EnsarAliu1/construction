import {PublicFooter} from "./public-footer";
import {PublicHeader} from "./public-header";
import {DemoEntryLink} from './demo-entry-link';
import Image from "next/image";
import type {ReactNode} from "react";
import {DesktopNavigation} from "@/components/layout/navigation";
import {dictionaries,publicNavigation,type Locale} from "@/i18n/dictionaries";
import {PublicMobileMenu} from "./mobile-menu";
export function PublicShell({locale,children}:{locale:Locale;children:ReactNode}){
 const c=dictionaries[locale],items=publicNavigation(locale),headerItems=[...items.slice(1,-1),{href:`/${locale}#procesi`,label:"Procesi"},items[items.length-1]];
 return <div className="public-layout" id="krye"><a className="skip-link" href="#main-content">{c.skip}</a><PublicHeader><div className="public-header-inner">
  <a className="site-logo" href={`/${locale}#krye`} aria-label="Construction"><Image src="/logos/construction.png" width={512} height={581} alt="" preload sizes="44px"/><span className="site-logo-wordmark">Construction<small>ARKITEKTURË & NDËRTIM</small></span></a>
  <DesktopNavigation items={headerItems} label={c.navigation} className="public-links"/><div className="header-controls"><DemoEntryLink className="header-quote">Provo Demo <span aria-hidden="true">↗</span></DemoEntryLink><PublicMobileMenu items={[...headerItems,{href:'/demo',label:'Provo Demo — Menaxhimi'}]} label={c.navigation} openLabel={c.menu} closeLabel={c.close}/></div>
 </div></PublicHeader><main id="main-content" tabIndex={-1}>{children}</main><PublicFooter items={headerItems}/></div>;
}
