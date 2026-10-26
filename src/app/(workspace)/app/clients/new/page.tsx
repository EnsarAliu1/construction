import { ClientLink as Link } from "@/features/clients/client-link";
import { PageHeading } from "@/components/ui";
import { ClientForm } from "@/features/clients/client-form";
import { requirePageUser } from "@/server/auth/web";

export const metadata = { title: "New client" };
export default async function NewClientPage() {
  await requirePageUser("/app/clients/new");
  return <><Link href="/app/clients" className="text-link client-back">← Clients</Link><PageHeading eyebrow="Clients" title="New client" description="Create an individual or business client. Contact and address details can be added later." /><ClientForm /></>;
}
