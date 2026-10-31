import {kosovoDate} from "@/lib/presentation";
import { ClientLink as Link } from "@/features/clients/client-link";
import {Badge, Card} from "@/components/ui";
import {WorkspaceHeading as PageHeading} from '@/components/workspace/page-heading';
import { ArchiveControl } from "@/features/clients/archive-control";
import { clientFields, clientTypeLabel, type ClientField } from "@/features/clients/model";
import { getClient } from "@/features/clients/service";
import { clientPageData } from "@/features/clients/web";


export const metadata = { title: "Detajet e klientit" };
function time(value: string) { return kosovoDate(value); }
export default async function ClientDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { client, relatedProjects, projectCount, hasOpenProjects,  } = await clientPageData(`/app/clients/${id}`, (connection, token) => getClient(connection, token, id));
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
    <Link className="text-link" href={`/app/history?entityId=${id}`}>Shikoni veprimet në Historik</Link>
    {!client.deletedAt && <Card className="client-archive-card"><ArchiveControl id={id} version={client.version} name={client.name} blocked={hasOpenProjects} /></Card>}
  </>;
}
