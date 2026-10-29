import { ClientLink as Link } from "@/features/clients/client-link";
import { PageHeading } from "@/components/ui";
import { ClientForm } from "@/features/clients/client-form";
import { requirePageUser } from "@/server/auth/web";

export const metadata = { title: "Klient i ri" };
export default async function NewClientPage() {
  await requirePageUser("/app/clients/new");
  return <><Link href="/app/clients" className="text-link client-back">← Klientët</Link><PageHeading eyebrow="Klientët" title="Klient i ri" description="Krijoni klient individual ose biznes. Kontakti dhe adresa mund të shtohen më vonë." /><ClientForm /></>;
}
