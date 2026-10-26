export const locales = ["sq", "en"] as const;
export type Locale = typeof locales[number];
export const publicPages = ["about", "services", "projects", "contact"] as const;
export type PublicPage = "home" | typeof publicPages[number];
export function isLocale(value: string): value is Locale { return locales.some(locale => locale === value); }
export function isPublicPage(value: string): value is typeof publicPages[number] { return publicPages.some(page => page === value); }

type PageCopy = { title: string; description: string; bodyTitle: string; body: string };
type Dictionary = {
  nav: Record<PublicPage, string>; menu: string; close: string; navigation: string; skip: string;
  brandNote: string; contentNote: string; footer: string; eyebrow: string;
  explore: string; contact: string; imagePlaceholder: string; imageNote: string;
  pages: Record<PublicPage, PageCopy>;
  serviceAreas: string[]; pending: string; projectEmpty: string;
  contactNote: string; name: string; email: string; message: string; submit: string;
};

export const dictionaries: Record<Locale, Dictionary> = {
  sq: {
    nav: { home: "Kryefaqja", about: "Rreth nesh", services: "Shërbimet", projects: "Projektet", contact: "Kontakti" },
    menu: "Menyja", close: "Mbyll", navigation: "Navigimi kryesor", skip: "Kalo te përmbajtja",
    brandNote: "Emërtim i përkohshëm", contentNote: "Përmbajtje paraprake · Në pritje të miratimit të klientit",
    footer: "Identiteti i kompanisë, fotografitë dhe të dhënat e kontaktit presin miratimin e klientit.",
    eyebrow: "Ndërtim · Prezantim i kompanisë", explore: "Shiko shërbimet", contact: "Faqja e kontaktit",
    imagePlaceholder: "Hapësirë për fotografinë e miratuar", imageNote: "Ilustrim skematik · Nuk paraqet projekt real",
    pages: {
      home: { title: "Një bazë e qartë për çdo projekt.", description: "Hapësira e ardhshme për prezantimin e kompanisë, shërbimeve dhe projekteve të saj.", bodyTitle: "Njihuni me kompaninë", body: "Këtu do të publikohet prezantimi i miratuar i kompanisë. Historia, përvoja dhe identiteti zyrtar do të shtohen pas konfirmimit nga klienti." },
      about: { title: "Rreth nesh", description: "Një vend për historinë, njerëzit dhe mënyrën e punës së kompanisë.", bodyTitle: "Historia që do të ndajmë", body: "Tekst i përkohshëm. Prezantimi i kompanisë, ekipi dhe historia do të shtohen pasi të dorëzohen dhe miratohen materialet përfundimtare." },
      services: { title: "Shërbimet", description: "Një pasqyrë e qartë e shërbimeve që do të prezantohen nga kompania.", bodyTitle: "Fushat e shërbimit", body: "Kategoritë më poshtë janë vetëm vende të rezervuara. Emërtimet, përshkrimet dhe fusha e shërbimeve presin miratimin e klientit." },
      projects: { title: "Projektet", description: "Hapësirë e rezervuar për projekte dhe fotografi të miratuara nga klienti.", bodyTitle: "Projektet do të prezantohen këtu", body: "Çdo prezantim do të përdorë vetëm përshkrime, të dhëna dhe fotografi të miratuara. Ende nuk ka projekte të publikuara." },
      contact: { title: "Kontakti", description: "Të dhënat zyrtare të kontaktit do të publikohen pas konfirmimit nga klienti.", bodyTitle: "Le të lidhemi", body: "Adresa, telefoni, emaili dhe orari i punës janë në pritje të materialeve të miratuara. Aktualisht nuk ka kanal kontakti aktiv në këtë faqe." },
    },
    serviceAreas: ["Shërbimi 01", "Shërbimi 02", "Shërbimi 03"], pending: "Përshkrimi pret miratimin e klientit.",
    projectEmpty: "Asnjë projekt i publikuar", contactNote: "Pamje paraprake. Dërgimi i mesazheve nuk është aktiv në këtë fazë.",
    name: "Emri", email: "Emaili", message: "Mesazhi", submit: "Dërgimi nuk është aktiv",
  },
  en: {
    nav: { home: "Home", about: "About us", services: "Services", projects: "Projects", contact: "Contact" },
    menu: "Menu", close: "Close", navigation: "Main navigation", skip: "Skip to content",
    brandNote: "Working title", contentNote: "Placeholder content · Awaiting client approval",
    footer: "Company identity, photography and contact details are awaiting client approval.",
    eyebrow: "Construction · Company introduction", explore: "Explore services", contact: "Contact page",
    imagePlaceholder: "Reserved for approved photography", imageNote: "Schematic illustration · Does not depict a real project",
    pages: {
      home: { title: "A clear foundation for every project.", description: "A future home for the company, its services and its construction projects.", bodyTitle: "Get to know the company", body: "The approved company introduction will appear here. Company history, experience and official identity will be added after client confirmation." },
      about: { title: "About us", description: "A place for the company's story, people and approach to work.", bodyTitle: "A story to be shared", body: "Placeholder copy. The company introduction, team and history will be added once the final materials have been supplied and approved." },
      services: { title: "Services", description: "A clear overview of the services the company will present.", bodyTitle: "Service areas", body: "The categories below are reserved spaces. Service names, descriptions and scope are awaiting client approval." },
      projects: { title: "Projects", description: "A space for construction projects and photography approved by the client.", bodyTitle: "Projects will be presented here", body: "Every project presentation will use approved descriptions, details and photographs. There are no published projects yet." },
      contact: { title: "Contact", description: "Official contact details will be published after confirmation by the client.", bodyTitle: "Get in touch", body: "The address, phone number, email and opening hours are awaiting approved materials. There is currently no active contact channel on this page." },
    },
    serviceAreas: ["Service 01", "Service 02", "Service 03"], pending: "Description awaiting client approval.",
    projectEmpty: "No published projects", contactNote: "Preview only. Message submission is unavailable in this phase.",
    name: "Name", email: "Email", message: "Message", submit: "Submission unavailable",
  },
};

export function publicNavigation(locale: Locale) {
  return (["home", ...publicPages] as const).map(page => ({
    href: page === "home" ? `/${locale}` : `/${locale}/${page}`,
    label: dictionaries[locale].nav[page],
  }));
}
