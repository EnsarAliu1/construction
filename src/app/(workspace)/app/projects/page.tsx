import { Card, EmptyState, Badge, PageHeading } from "@/components/ui";
import { ProjectLink as Link } from "@/features/projects/project-link";
import { ProjectSearchForm } from "@/features/projects/search-form";
import { chooseClients, listProjects } from "@/features/projects/service";
import { projectPageData } from "@/features/projects/web";
import { ProjectError, parseProjectQuery } from "@/features/projects/validation";
import { requirePageUser } from "@/server/auth/web";
import { getClient } from "@/features/clients/service";

export const metadata = { title: "Projects" };
export const dynamic = "force-dynamic";
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser("/app/projects");
  let query: ReturnType<typeof parseProjectQuery>;
  try { query = parseProjectQuery(await searchParams); } catch (error) { if (!(error instanceof ProjectError)) throw error; return <Card><h1>Projects</h1><p role="alert">{error.message}</p><Link className="text-link" href="/app/projects">Clear filters</Link></Card>; }
  const result = await projectPageData("/app/projects", async (c, token) => {
    const data = await listProjects(c, token, query); const choices = await chooseClients(c, token);
    let filteredClient = null;
    if (query.clientId) { try { const { client } = await getClient(c, token, query.clientId); filteredClient = { id: client.id, name: client.name, version: client.version }; } catch { /* Unknown filters safely show no projects. */ } }
    return { ...data, choices, filteredClient };
  });
  const { rows, total, pageSize, choices, filteredClient } = result; const pages = Math.max(1, Math.ceil(total / pageSize));
  function href(page: number) { return `/app/projects?${new URLSearchParams({ q: query.q, status: query.status, ...(query.clientId ? { clientId: query.clientId } : {}), page: String(page) })}`; }
  return <><PageHeading eyebrow="Operations" title="Projects" description="Construction sites, client relationships, contracts and financial phases."><Link className="button" href="/app/projects/new">New project</Link></PageHeading><Card className="client-filter-card"><ProjectSearchForm key={JSON.stringify(query)} {...{ query, choices, filteredClient }} /></Card><div className="section-title"><h2>{total} {total === 1 ? "project" : "projects"}</h2></div><Card className="table-card">{rows.length ? <div className="table-scroll" role="region" aria-label="Projects results; scroll horizontally on small screens" tabIndex={0}><table className="projects-table"><caption className="sr-only">Projects, page {query.page} of {pages}</caption><thead><tr>{["Project / Client", "Status", "Dates", "Contract (EUR)", "Action"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><Link className="client-name-link" href={`/app/projects/${row.id}`}>{row.name}</Link><Link className="text-link muted" href={`/app/clients/${row.clientId}`}>{row.clientName}</Link></td><td><Badge>{row.status}</Badge></td><td><span>Start: {row.startDate ?? "Not set"}</span><span>End: {row.endDate ?? "Not set"}</span></td><td>{row.totalValue ?? "Not set"}</td><td><Link className="text-link" href={`/app/projects/${row.id}`}>View project</Link></td></tr>)}</tbody></table></div> : <><EmptyState title={query.page > 1 ? "No projects on this page" : query.q || query.status !== "all" || query.clientId ? "No matching projects" : "No projects yet"} description="Create a project linked to an active client, or adjust your search and filters." /><div className="client-empty-actions"><Link className="text-link" href={href(1)}>First page</Link><Link className="button" href="/app/projects/new">Create project</Link></div></>}</Card><nav className="client-pagination" aria-label="Projects pagination"><div>{query.page > 1 && <Link className="button client-secondary" href={href(query.page - 1)}>Previous</Link>}</div><p>Page {query.page} of {pages}</p><div>{query.page < pages && <Link className="button client-secondary" href={href(query.page + 1)}>Next</Link>}</div></nav></>;
}
