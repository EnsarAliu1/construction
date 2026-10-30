import {RecordAvatar,RecordsBar} from '@/components/workspace/record-ui';
import {DataTable} from '@/components/workspace/data-table';
import { ClientLink as Link } from "@/features/clients/client-link";
import {Card, EmptyState, Badge} from "@/components/ui";
import {WorkspaceHeading as PageHeading} from '@/components/workspace/page-heading';
import { ClientSearchForm } from "@/features/clients/search-form";
import { clientTypeLabel } from "@/features/clients/model";
import { listClients } from "@/features/clients/service";
import { ClientValidationError, parseClientQuery, type ClientQuery } from "@/features/clients/validation";
import { clientPageData } from "@/features/clients/web";
import { requirePageUser } from "@/server/auth/web";

export const metadata = { title: "Klientët" };
export const dynamic = "force-dynamic";
function pageHref(query: ClientQuery, page: number) { return `/app/clients?${new URLSearchParams({ q: query.q, type: query.type, page: String(page) })}`; }

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; type?: string | string[]; page?: string | string[] }> }) {
  await requirePageUser("/app/clients");
  let query: ClientQuery;
  try { query = parseClientQuery(await searchParams); }
  catch (error) {
    if (!(error instanceof ClientValidationError)) throw error;
    return <><PageHeading eyebrow="Veprimet" title="Klientët" description="Menaxhoni klientët individualë dhe bizneset." /><Card><div role="alert" className="client-alert client-alert-error"><p>{Object.values(error.fields).join(" ")}</p><Link className="text-link" href="/app/clients">Pastroni kërkimin dhe filtrat</Link></div></Card></>;
  }
  const { rows, total, pageSize } = await clientPageData("/app/clients", (connection, token) => listClients(connection, token, query));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(query.q || query.type !== "all");
  return <>
    <PageHeading eyebrow="Veprimet" title="Klientët" description="Menaxhoni klientët individualë dhe bizneset, kontaktet dhe lidhjet me projektet."><Link href="/app/clients/new" className="button">Klient i ri</Link></PageHeading>
    <Card className="client-filter-card"><ClientSearchForm key={JSON.stringify({...query,q:undefined})} query={query} /></Card>
    <RecordsBar total={total} label="Klientët" description="Kontaktet dhe lidhjet me punishtet" options={([['all','Të gjithë'],['business','Biznese'],['private_person','Individë']]as const).map(([type,label])=>({label,active:query.type===type,href:'/app/clients?'+new URLSearchParams({q:query.q,type,page:'1'})}))}/>
    <Card className="table-card">
      {rows.length ? <div className="table-scroll client-table-region" role="region" aria-label="Rezultatet e klientëve; lëvizni horizontalisht në ekranet e vogla" tabIndex={0}><DataTable className="clients-table contacts-table"><caption className="sr-only">Klientët, faqja {query.page} nga {pages}</caption><thead><tr><th scope="col">Klienti</th><th scope="col">Kontakti</th><th scope="col">Lokacioni</th><th scope="col">Veprimi</th></tr></thead><tbody>
        {rows.map(client => <tr key={client.id}><td><div className="record-identity"><RecordAvatar name={client.name}/><div><Link className="client-name-link" href={`/app/clients/${client.id}`}>{client.name}</Link><Badge>{clientTypeLabel(client.type)}</Badge>{client.type === "business" && client.nui && <span className="muted client-cell-note">NUI: {client.nui}</span>}</div></div></td><td>{client.email || client.phone ? <>{client.email && <span>{client.email}</span>}{client.phone && <span>{client.phone}</span>}</> : <span className="muted">Pa të dhëna kontakti</span>}</td><td>{[client.city, client.country].filter(Boolean).join(", ") || <span className="muted">Nuk është dhënë</span>}</td><td><Link className="text-link" href={`/app/clients/${client.id}`} aria-label={`Shikoni ${client.name}`}>Shikoni klientin</Link></td></tr>)}
      </tbody></DataTable></div> : <><EmptyState title={query.page > 1 ? "Nuk ka klientë në këtë faqe" : filtered ? "Nuk u gjetën klientë sipas kërkimit" : "Ende nuk ka klientë"} description={query.page > 1 ? "Faqja e zgjedhur nuk ka rezultate. Kthehuni te faqja e parë." : filtered ? "Provoni kërkim tjetër ose pastroni filtrat." : "Krijoni klientin e parë individual ose biznes. Nuk kërkohet projekt."} /><div className="client-empty-actions">{query.page > 1 && <Link className="text-link" href={pageHref(query, 1)}>Faqja e parë</Link>}{filtered ? <Link className="text-link" href="/app/clients">Pastroni filtrat</Link> : <Link className="button" href="/app/clients/new">Krijoni klient</Link>}</div></>}
    </Card>
    <nav className="client-pagination" aria-label="Faqet e klientëve"><div>{query.page > 1 && <Link className="button client-secondary" href={pageHref(query, query.page - 1)}>Para</Link>}</div><p>Faqja {query.page} nga {pages}</p><div>{query.page < pages && <Link className="button client-secondary" href={pageHref(query, query.page + 1)}>Pas</Link>}</div></nav>
  </>;
}
