import { ClientLink as Link } from "@/features/clients/client-link";
import { Badge, Card, PageHeading } from "@/components/ui";
import { ArchiveControl } from "@/features/clients/archive-control";
import { clientFields, clientTypeLabel, type ClientField } from "@/features/clients/model";
import { getClient } from "@/features/clients/service";
import { clientPageData } from "@/features/clients/web";
import type { HistorySnapshot } from "@/server/db/history-snapshot";

export const metadata = { title: "Client details" };
function time(value: string) { return `${value.replace("T", " ")} UTC`; }
function Snapshot({ value, label }: { value: HistorySnapshot | null; label: string }) {
  if (!value) return <p className="muted">{label}: no previous record</p>;
  return <section><h3>{label}</h3><dl className="client-snapshot">{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{clientFields[key as ClientField]?.label ?? key}</dt><dd>{entry === null ? "Not recorded" : String(entry)}</dd></div>)}</dl></section>;
}
const actionLabels: Record<string, string> = { client_created: "Client created", client_updated: "Client updated", client_archived: "Client archived" };

export default async function ClientDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { client, relatedProjects, projectCount, hasOpenProjects, history } = await clientPageData(`/app/clients/${id}`, (connection, token) => getClient(connection, token, id));
  const { notice } = await searchParams;
  const success = notice === "created" ? "Client created." : notice === "updated" ? "Client changes saved." : notice === "archived" && client.deletedAt ? "Client archived." : null;
  return <>
    <Link href="/app/clients" className="text-link client-back">← Clients</Link>
    <PageHeading eyebrow={clientTypeLabel(client.type)} title={client.name} description={client.deletedAt ? "Archived client. Identity, project references and history are retained." : "Contact information, project references and recorded changes."}>{!client.deletedAt && <Link className="button" href={`/app/clients/${id}/edit`}>Edit client</Link>}</PageHeading>
    {success && <p className="client-alert client-success" role="status">{success}</p>}
    {client.deletedAt && <p className="client-alert" role="status">Archived on {time(client.deletedAt)}. This record is read-only.</p>}
    <div className="client-detail-columns">
      <Card><h2>Client information</h2><dl className="client-details-grid"><div><dt>Client reference</dt><dd className="client-reference">{client.id}</dd></div><div><dt>Type</dt><dd><Badge>{clientTypeLabel(client.type)}</Badge></dd></div>{Object.entries(clientFields).filter(([key]) => key !== "name").map(([key, field]) => <div key={key}><dt>{field.label.replace(" (optional)", "")}</dt><dd>{client[key as ClientField] || <span className="muted">Not provided</span>}</dd></div>)}<div><dt>Created</dt><dd>{time(client.createdAt)}</dd></div><div><dt>Last updated</dt><dd>{time(client.updatedAt)}</dd></div><div><dt>Record version</dt><dd>{client.version}</dd></div></dl></Card>
      <Card><h2>Related projects</h2><p className="muted client-form-note">{projectCount} {projectCount === 1 ? "project references" : "projects reference"} this client.</p>{relatedProjects.length ? <><ul className="client-project-list">{relatedProjects.map(project => <li key={project.id}>{project.deletedAt ? <strong>{project.name}</strong> : <a className="text-link" href={`/app/projects/${project.id}`}>{project.name}</a>}<Badge>{project.deletedAt ? "Archived" : project.status}</Badge></li>)}</ul>{projectCount > relatedProjects.length && <p className="muted">Showing the latest {relatedProjects.length} project references.</p>}</> : <p className="muted">No projects are linked to this client.</p>}<a className="text-link" href={`/app/projects?clientId=${client.id}`}>View projects for this client</a></Card>
    </div>
    <Card className="client-history"><h2>Audit history</h2><p className="muted client-form-note">Latest 20 recorded changes. Older records remain retained.</p>{history.length ? <ol>{history.map(event => <li key={event.id}><details><summary><strong>{actionLabels[event.action] ?? "Client record changed"}</strong><span>{time(event.recordedAt)} · {event.actorName ?? "Actor not recorded"}</span></summary><div className="client-history-snapshots"><Snapshot label="Before" value={event.before} /><Snapshot label="After" value={event.after} /></div></details></li>)}</ol> : <p className="muted">No client change events have been recorded. Existing historical clients may predate this module.</p>}</Card>
    {!client.deletedAt && <Card className="client-archive-card"><ArchiveControl id={id} version={client.version} name={client.name} blocked={hasOpenProjects} /></Card>}
  </>;
}
