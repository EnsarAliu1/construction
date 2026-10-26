import { ClientLink as Link } from "@/features/clients/client-link";
import { Card, PageHeading } from "@/components/ui";
import { ClientForm } from "@/features/clients/client-form";
import { getClient } from "@/features/clients/service";
import { clientPageData } from "@/features/clients/web";

export const metadata = { title: "Edit client" };
export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client } = await clientPageData(`/app/clients/${id}/edit`, (connection, token) => getClient(connection, token, id));
  return <><Link href={`/app/clients/${id}`} className="text-link client-back">← Client details</Link><PageHeading eyebrow="Clients" title="Edit client" description={client.name} />{client.deletedAt ? <Card><p className="client-alert" role="status">Archived clients are read-only.</p><Link href={`/app/clients/${id}`} className="text-link">View retained record</Link></Card> : <ClientForm client={client} />}</>;
}
