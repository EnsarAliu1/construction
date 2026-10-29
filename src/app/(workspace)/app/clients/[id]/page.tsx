import {fieldLabel,fieldValue} from "@/i18n/format";
import { ClientLink as Link } from "@/features/clients/client-link";
import { Badge, Card, PageHeading } from "@/components/ui";
import { ArchiveControl } from "@/features/clients/archive-control";
import { clientFields, clientTypeLabel, type ClientField } from "@/features/clients/model";
import { getClient } from "@/features/clients/service";
import { clientPageData } from "@/features/clients/web";
import type { HistorySnapshot } from "@/server/db/history-snapshot";

export const metadata = { title: "Detajet e klientit" };
function time(value: string) { return `${value.replace("T", " ")} UTC`; }
function Snapshot({ value, label }: { value: HistorySnapshot | null; label: string }) {
  if (!value) return <p className="muted">{label}: pa të dhëna të mëparshme</p>;
  return <section><h3>{label}</h3><dl className="client-snapshot">{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{clientFields[key as ClientField]?.label ?? fieldLabel(key)}</dt><dd>{fieldValue(key,entry)}</dd></div>)}</dl></section>;
}
const actionLabels: Record<string, string> = { client_created: "Klienti u krijua", client_updated: "Klienti u përditësua", client_archived: "Klienti u arkivua" };

export default async function ClientDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { client, relatedProjects, projectCount, hasOpenProjects, history } = await clientPageData(`/app/clients/${id}`, (connection, token) => getClient(connection, token, id));
  const { notice } = await searchParams;
  const success = notice === "created" ? "Klienti u krijua." : notice === "updated" ? "Ndryshimet e klientit u ruajtën." : notice === "archived" && client.deletedAt ? "Klienti u arkivua." : null;
  return <>
    <Link href="/app/clients" className="text-link client-back">← Klientët</Link>
    <PageHeading eyebrow={clientTypeLabel(client.type)} title={client.name} description={client.deletedAt ? "Klient i arkivuar. Identiteti, lidhjet me projektet dhe historiku ruhen." : "Të dhënat e kontaktit, lidhjet me projektet dhe ndryshimet e regjistruara."}>{!client.deletedAt && <Link className="button" href={`/app/clients/${id}/edit`}>Ndryshoni klientin</Link>}</PageHeading>
    {success && <p className="client-alert client-success" role="status">{success}</p>}
    {client.deletedAt && <p className="client-alert" role="status">Arkivuar më {time(client.deletedAt)}. Këto të dhëna mund vetëm të shikohen.</p>}
    <div className="client-detail-columns">
      <Card><h2>Të dhënat e klientit</h2><dl className="client-details-grid"><div><dt>Identifikuesi i klientit</dt><dd className="client-reference">{client.id}</dd></div><div><dt>Lloji</dt><dd><Badge>{clientTypeLabel(client.type)}</Badge></dd></div>{Object.entries(clientFields).filter(([key]) => key !== "name").map(([key, field]) => <div key={key}><dt>{field.label.replace(" (opsionale)", "")}</dt><dd>{client[key as ClientField] || <span className="muted">Nuk është dhënë</span>}</dd></div>)}<div><dt>Krijuar</dt><dd>{time(client.createdAt)}</dd></div><div><dt>Përditësimi i fundit</dt><dd>{time(client.updatedAt)}</dd></div><div><dt>Versioni i të dhënave</dt><dd>{client.version}</dd></div></dl></Card>
      <Card><h2>Projektet e lidhura</h2><p className="muted client-form-note">{projectCount} {projectCount === 1 ? "lidhje me projekte" : "projekte lidhen me"} këtë klient.</p>{relatedProjects.length ? <><ul className="client-project-list">{relatedProjects.map(project => <li key={project.id}>{project.deletedAt ? <strong>{project.name}</strong> : <a className="text-link" href={`/app/projects/${project.id}`}>{project.name}</a>}<Badge>{project.deletedAt ? "Arkivuar" : project.status}</Badge></li>)}</ul>{projectCount > relatedProjects.length && <p className="muted">Shfaqen të fundit {relatedProjects.length} lidhje me projekte.</p>}</> : <p className="muted">Asnjë projekt nuk lidhet me këtë klient.</p>}<a className="text-link" href={`/app/projects?clientId=${client.id}`}>Shikoni projektet e këtij klienti</a></Card>
    </div>
    <Card className="client-history"><h2>Historiku i veprimeve</h2><p className="muted client-form-note">20 ndryshimet e fundit. Të dhënat më të vjetra ruhen.</p>{history.length ? <ol>{history.map(event => <li key={event.id}><details><summary><strong>{actionLabels[event.action] ?? "Të dhënat e klientit u ndryshuan"}</strong><span>{time(event.recordedAt)} · {event.actorName ?? "Përdoruesi nuk është regjistruar"}</span></summary><div className="client-history-snapshots"><Snapshot label="Para" value={event.before} /><Snapshot label="Pas" value={event.after} /></div></details></li>)}</ol> : <p className="muted">Nuk janë regjistruar ndryshime. Klientët e vjetër mund të jenë krijuar para këtij moduli.</p>}</Card>
    {!client.deletedAt && <Card className="client-archive-card"><ArchiveControl id={id} version={client.version} name={client.name} blocked={hasOpenProjects} /></Card>}
  </>;
}
