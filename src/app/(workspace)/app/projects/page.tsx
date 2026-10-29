import {valueLabel} from "@/i18n/format";
import { Card, EmptyState, Badge, PageHeading } from "@/components/ui";
import { ProjectLink as Link } from "@/features/projects/project-link";
import { ProjectSearchForm } from "@/features/projects/search-form";
import { chooseClients, listProjects } from "@/features/projects/service";
import { projectPageData } from "@/features/projects/web";
import { ProjectError, parseProjectQuery } from "@/features/projects/validation";
import { requirePageUser } from "@/server/auth/web";
import { getClient } from "@/features/clients/service";

export const metadata = { title: "Projektet" };
export const dynamic = "force-dynamic";
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser("/app/projects");
  let query: ReturnType<typeof parseProjectQuery>;
  try { query = parseProjectQuery(await searchParams); } catch (error) { if (!(error instanceof ProjectError)) throw error; return <Card><h1>Projektet</h1><p role="alert">{error.message}</p><Link className="text-link" href="/app/projects">Pastroni filtrat</Link></Card>; }
  const result = await projectPageData("/app/projects", async (c, token) => {
    const data = await listProjects(c, token, query); const choices = await chooseClients(c, token);
    let filteredClient = null;
    if (query.clientId) { try { const { client } = await getClient(c, token, query.clientId); filteredClient = { id: client.id, name: client.name, version: client.version }; } catch { /* Unknown filters safely show no projects. */ } }
    return { ...data, choices, filteredClient };
  });
  const { rows, total, pageSize, choices, filteredClient } = result; const pages = Math.max(1, Math.ceil(total / pageSize));
  function href(page: number) { return `/app/projects?${new URLSearchParams({ q: query.q, status: query.status, ...(query.clientId ? { clientId: query.clientId } : {}), page: String(page) })}`; }
  return <><PageHeading eyebrow="Veprimet" title="Projektet" description="Vendet e ndërtimit, klientët, kontratat dhe fazat financiare."><Link className="button" href="/app/projects/new">Projekt i ri</Link></PageHeading><Card className="client-filter-card"><ProjectSearchForm key={JSON.stringify(query)} {...{ query, choices, filteredClient }} /></Card><div className="section-title"><h2>{total} {total === 1 ? "project" : "projects"}</h2></div><Card className="table-card">{rows.length ? <div className="table-scroll" role="region" aria-label="Rezultatet e projekteve; lëvizni horizontalisht në ekranet e vogla" tabIndex={0}><table className="projects-table"><caption className="sr-only">Projektet, faqja {query.page} nga {pages}</caption><thead><tr>{["Projekti / Klienti", "Gjendja", "Datat", "Kontrata (EUR)", "Veprimi"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><Link className="client-name-link" href={`/app/projects/${row.id}`}>{row.name}</Link><Link className="text-link muted" href={`/app/clients/${row.clientId}`}>{row.clientName}</Link></td><td><Badge>{valueLabel(row.status)}</Badge></td><td><span>Fillimi: {row.startDate ?? "Nuk është përcaktuar"}</span><span>Përfundimi: {row.endDate ?? "Nuk është përcaktuar"}</span></td><td>{row.totalValue ?? "Nuk është përcaktuar"}</td><td><Link className="text-link" href={`/app/projects/${row.id}`}>Shikoni projektin</Link></td></tr>)}</tbody></table></div> : <><EmptyState title={query.page > 1 ? "Nuk ka projekte në këtë faqe" : query.q || query.status !== "all" || query.clientId ? "Nuk u gjetën projekte sipas kërkimit" : "Ende nuk ka projekte"} description="Krijoni projekt të lidhur me klient aktiv ose ndryshoni kërkimin dhe filtrat." /><div className="client-empty-actions"><Link className="text-link" href={href(1)}>Faqja e parë</Link><Link className="button" href="/app/projects/new">Krijoni projekt</Link></div></>}</Card><nav className="client-pagination" aria-label="Faqet e projekteve"><div>{query.page > 1 && <Link className="button client-secondary" href={href(query.page - 1)}>Para</Link>}</div><p>Faqja {query.page} nga {pages}</p><div>{query.page < pages && <Link className="button client-secondary" href={href(query.page + 1)}>Pas</Link>}</div></nav></>;
}
