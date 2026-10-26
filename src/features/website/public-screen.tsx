import Link from "next/link";
import { Badge, Button, Card, EmptyState, FormField, Input } from "@/components/ui";
import { dictionaries, type Locale, type PublicPage } from "@/i18n/dictionaries";

export function PublicScreen({ locale, page }: { locale: Locale; page: PublicPage }) {
  const copy = dictionaries[locale];
  const content = copy.pages[page];
  return <>
    <section className={`public-container public-hero ${page === "home" ? "home-hero" : ""}`}>
      <div className="hero-copy"><p className="eyebrow">{copy.eyebrow}</p><h1>{content.title}</h1><p className="hero-description">{content.description}</p>
        {page === "home" && <div className="hero-actions"><Link href={`/${locale}/services`} className="button">{copy.explore} <span aria-hidden="true">↗</span></Link><Link className="text-link" href={`/${locale}/contact`}>{copy.contact} <span aria-hidden="true">→</span></Link></div>}
        <p className="content-note">{copy.contentNote}</p>
      </div>
      {(page === "home" || page === "about") && <figure className="blueprint"><div className="blueprint-drawing" aria-hidden="true"><span className="plan-room room-one" /><span className="plan-room room-two" /><span className="plan-room room-three" /><span className="plan-axis" /></div><figcaption><span>{copy.imagePlaceholder}</span><small>{copy.imageNote}</small></figcaption></figure>}
    </section>
    <section className="public-section"><div className="public-container">
      <div className="public-section-heading"><span className="eyebrow">{page === "home" ? "01" : "02"} / {copy.nav[page]}</span><div><h2>{content.bodyTitle}</h2><p className="muted">{content.body}</p></div></div>
      {page === "home" && <div className="public-paths">{(["about", "services", "projects"] as const).map((item, index) => <Link key={item} href={`/${locale}/${item}`}><span className="eyebrow">0{index + 1}</span><h3>{copy.nav[item]} <span aria-hidden="true">↗</span></h3><p className="muted">{copy.pages[item].description}</p></Link>)}</div>}
      {page === "services" && <div className="dashboard-grid">{copy.serviceAreas.map((title, index) => <Card key={title}><p className="eyebrow">0{index + 1}</p><h3>{title}</h3><p className="muted">{copy.pending}</p><Badge>{copy.brandNote}</Badge></Card>)}</div>}
      {page === "projects" && <Card><EmptyState title={copy.projectEmpty} description={copy.pending} /></Card>}
      {page === "about" && <Card className="about-placeholder"><Badge>{copy.contentNote}</Badge><p className="muted">{copy.imagePlaceholder}</p></Card>}
      {page === "contact" && <Card className="contact-preview"><p id="contact-note" className="notice">{copy.contactNote}</p><fieldset disabled aria-describedby="contact-note"><legend className="sr-only">{copy.nav.contact}</legend>
        <div className="form-grid"><FormField label={copy.name} htmlFor="name"><Input id="name" name="name" autoComplete="name" /></FormField><FormField label={copy.email} htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" /></FormField></div>
        <FormField label={copy.message} htmlFor="message"><textarea id="message" name="message" className="input" rows={4} /></FormField><Button disabled type="button">{copy.submit}</Button>
      </fieldset></Card>}
    </div></section>
  </>;
}
