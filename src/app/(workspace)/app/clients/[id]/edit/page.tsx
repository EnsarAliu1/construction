import { ClientLink as Link } from "@/features/clients/client-link";
import { Card, PageHeading } from "@/components/ui";
import { ClientForm } from "@/features/clients/client-form";
import { getClient } from "@/features/clients/service";
import { clientPageData } from "@/features/clients/web";

export const metadata = { title: "Ndryshoni klientin" };
export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client } = await clientPageData(`/app/clients/${id}/edit`, (connection, token) => getClient(connection, token, id));
  return <><Link href={`/app/clients/${id}`} className="text-link client-back">← Detajet e klientit</Link><PageHeading eyebrow="Klientët" title="Ndryshoni klientin" description={client.name} />{client.deletedAt ? <Card><p className="client-alert" role="status">Klientët e arkivuar mund vetëm të shikohen.</p><Link href={`/app/clients/${id}`} className="text-link">Shikoni të dhënat e ruajtura</Link></Card> : <ClientForm client={client} />}</>;
}
