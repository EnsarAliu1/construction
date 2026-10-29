import Link from 'next/link';
import type {NavigationItem} from '@/types/navigation';
import {AboutMotion} from '@/features/website/about-motion';
import {publishedContacts} from '@/features/website/content';

// Owner-requested sample details. Replace with verified company details before publication.
const exampleContact={street:'Rruga Shembull 12',city:'10000 Qyteti, Shteti',email:'kontakt@fitimi.example',phone:'+00 000 000 000'};

export function PublicFooter({items}:{items:NavigationItem[]}){
 const contacts=publishedContacts(),addresses=contacts.filter(entry=>entry.kind==='address'),channels=contacts.filter(entry=>entry.kind!=='address');
 return <footer className="site-footer"><AboutMotion><div className="showcase-container">
  <div className="site-footer-brand" data-about-reveal aria-hidden="true"><svg viewBox="0 0 1650 210" focusable="false"><text x="0" y="190" fontFamily="Arial, Helvetica, sans-serif" fontWeight="750" fontSize="240" letterSpacing="-14" textLength="1650" lengthAdjust="spacingAndGlyphs">FITIMI</text></svg></div>
  <div className="site-footer-columns">
   <div className="site-footer-column" data-about-reveal><h2>Adresa</h2>{addresses.length?addresses.map(entry=><address key={entry.value}>{entry.value}</address>):<><address>{exampleContact.street}<br/>{exampleContact.city}</address><p className="site-footer-pending">Adresë ilustruese</p></>}</div>
   <div className="site-footer-column" data-about-reveal><h2>Kontakti</h2>{channels.length?channels.map(entry=><a key={entry.value} href={`${entry.kind==='email'?'mailto':'tel'}:${entry.value}`}>{entry.value}</a>):<><p>{exampleContact.email}<br/>{exampleContact.phone}</p><p className="site-footer-pending">Të dhëna ilustruese</p></>}</div>
   <nav className="site-footer-column" aria-label="Navigimi në fund të faqes" data-about-reveal><h2>Navigimi</h2>{items.map(item=><Link href={item.href} key={item.href}>{item.label}</Link>)}</nav>
   <div className="site-footer-column site-footer-social" data-about-reveal><h2>Na ndiqni</h2><span>Instagram</span><span>LinkedIn</span><span>Behance</span><p className="site-footer-pending">Profile ilustruese</p></div>
  </div>
  <div className="site-footer-bottom" data-about-reveal><p>© 2026 Fitimi Construction. Të gjitha të drejtat e rezervuara.</p><p>Hapësira që frymëzojnë. Ndërtime që zgjasin.</p></div>
 </div></AboutMotion></footer>;
}
