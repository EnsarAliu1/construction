import { ClientLink as Link } from "@/features/clients/client-link";
import { Card, EmptyState, PageHeading, Badge } from "@/components/ui";
import { ClientSearchForm } from "@/features/clients/search-form";
import { clientTypeLabel } from "@/features/clients/model";
import { listClients } from "@/features/clients/service";
import { ClientValidationError, parseClientQuery, type ClientQuery } from "@/features/clients/validation";
import { clientPageData } from "@/features/clients/web";
import { requirePageUser } from "@/server/auth/web";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";
function pageHref(query: ClientQuery, page: number) { return `/app/clients?${new URLSearchParams({ q: query.q, type: query.type, page: String(page) })}`; }

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; type?: string | string[]; page?: string | string[] }> }) {
  await requirePageUser("/app/clients");
  let query: ClientQuery;
  try { query = parseClientQuery(await searchParams); }
  catch (error) {
    if (!(error instanceof ClientValidationError)) throw error;
    return <><PageHeading eyebrow="Operations" title="Clients" description="Manage individual and business clients." /><Card><div role="alert" className="client-alert client-alert-error"><p>{Object.values(error.fields).join(" ")}</p><Link className="text-link" href="/app/clients">Clear search and filters</Link></div></Card></>;
  }
  const { rows, total, pageSize } = await clientPageData("/app/clients", (connection, token) => listClients(connection, token, query));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(query.q || query.type !== "all");
  return <>
    <PageHeading eyebrow="Operations" title="Clients" description="Manage individual and business clients, contact details and project references."><Link href="/app/clients/new" className="button">New client</Link></PageHeading>
    <Card className="client-filter-card"><ClientSearchForm query={query} /></Card>
    <div className="section-title client-results"><h2>{total} {total === 1 ? "client" : "clients"}{filtered ? " found" : ""}</h2><p className="muted">Archived clients are excluded.</p></div>
    <Card className="table-card">
      {rows.length ? <div className="table-scroll client-table-region" role="region" aria-label="Clients results, scroll horizontally on smaller screens" tabIndex={0}><table className="clients-table"><caption className="sr-only">Clients, page {query.page} of {pages}</caption><thead><tr><th scope="col">Client</th><th scope="col">Contact</th><th scope="col">Location</th><th scope="col">Action</th></tr></thead><tbody>
        {rows.map(client => <tr key={client.id}><td><Link className="client-name-link" href={`/app/clients/${client.id}`}>{client.name}</Link><Badge>{clientTypeLabel(client.type)}</Badge>{client.type === "business" && client.nui && <span className="muted client-cell-note">NUI: {client.nui}</span>}</td><td>{client.email || client.phone ? <>{client.email && <span>{client.email}</span>}{client.phone && <span>{client.phone}</span>}</> : <span className="muted">No contact details</span>}</td><td>{[client.city, client.country].filter(Boolean).join(", ") || <span className="muted">Not provided</span>}</td><td><Link className="text-link" href={`/app/clients/${client.id}`} aria-label={`View ${client.name}`}>View client</Link></td></tr>)}
      </tbody></table></div> : <><EmptyState title={query.page > 1 ? "No clients on this page" : filtered ? "No matching clients" : "No clients yet"} description={query.page > 1 ? "The selected page has no results. Return to the first page." : filtered ? "Try another search or clear the filters." : "Create your first individual or business client. A project is not required."} /><div className="client-empty-actions">{query.page > 1 && <Link className="text-link" href={pageHref(query, 1)}>First page</Link>}{filtered ? <Link className="text-link" href="/app/clients">Clear filters</Link> : <Link className="button" href="/app/clients/new">Create client</Link>}</div></>}
    </Card>
    <nav className="client-pagination" aria-label="Clients pagination"><div>{query.page > 1 && <Link className="button client-secondary" href={pageHref(query, query.page - 1)}>Previous</Link>}</div><p>Page {query.page} of {pages}</p><div>{query.page < pages && <Link className="button client-secondary" href={pageHref(query, query.page + 1)}>Next</Link>}</div></nav>
  </>;
}
