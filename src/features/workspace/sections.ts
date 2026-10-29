export const sections = {
  clients: { title: "Klientët", description: "Vend i përbashkët për të dhënat e klientëve dhe projektet e tyre të ndërtimit.", columns: ["Klienti", "Kontakti", "Projektet"], empty: "Ende nuk ka klientë" },
  projects: { title: "Projektet", description: "Projektet përfshijnë kontratat, fazat financiare dhe pagesat. Gjendjet e projektit: Aktiv, Pezulluar dhe Përfunduar.", columns: ["Projekti", "Klienti", "Gjendja"], empty: "Ende nuk ka projekte" },
  payments: { title: "Të hyrat / Pagesat", description: "Pagesat e pranuara dhe ndarja e saktë në faza financiare në EUR. Pagesat e konfirmuara lëshojnë dëftesa operative JO-FISKALE.", columns: ["Pagesa", "Projekti", "Data", "Shuma (EUR)"], empty: "Nuk ka pagesa të pranuara" },
  expenses: { title: "Daljet Financiare", description: "Pagesat dalëse reale në EUR, për kompaninë ose të lidhura me projekt, furnitor dhe automjet.", columns: ["Shpenzimi", "Furnitori / Përfituesi", "Projekti", "Shuma (EUR)"], empty: "Nuk ka pagesa dalëse" },
  receipts: { title: "Dëftesat", description: "Dëftesa operative JO-FISKALE me numër, versione PDF të pandryshueshme dhe historik anulimesh.", columns: ["Receipt", "Pagesa", "Data"], empty: "Ende nuk ka dëftesa" },
  reports: { title: "Raportet", description: "Raporte operative të kompanisë në PDF/XLSX, përmbledhje të projekteve në ekran dhe eksport i plotë i të dhënave të biznesit.", columns: ["Raporti", "Periudha", "Disponueshmëria"], empty: "Nuk u gjetën transaksione të kompanisë sipas filtrave" },
  categories: { title: "Kategoritë", description: "Organizoni pagesat dalëse me kategori të qëndrueshme shpenzimesh.", columns: ["Kategoria", "Përshkrimi"], empty: "Ende nuk ka kategori" },
  persons: { title: "Personat / Furnitorët", description: "Menaxhoni furnitorët dhe përfituesit e pagesave të lidhur me shpenzimet.", columns: ["Emri", "Kontakti", "Lloji"], empty: "Ende nuk ka furnitorë ose përfitues" },
  vehicles: { title: "Automjetet", description: "Të dhënat e automjeteve të kompanisë dhe shpenzimet e lidhura me to.", columns: ["Automjeti", "Regjistrimi", "Shënimet"], empty: "Ende nuk ka automjete" },
  accounts: { title: "Llogaritë e përdoruesve", description: "Përdoruesit kanë qasje operative të barabartë. Krijimi, aktivizimi dhe rikuperimi i llogarive menaxhohen nga Adore përmes operatorit të autorizuar.", columns: ["Qasja në llogari", "Administrimi"], empty: "Kontaktoni operatorin e autorizuar Adore për ndryshimet e llogarive" },
} as const;

export type SectionKey = keyof typeof sections;
export function isSection(value: string): value is SectionKey { return Object.hasOwn(sections, value); }
export const workspaceNavigation = [
  { href: "/app", label: "Përmbledhja" },
  ...Object.entries(sections).map(([key, value]) => ({ href: `/app/${key}`, label: value.title })),
];
