import { PageHeading } from "@/components/ui";
import { ProjectForm } from "@/features/projects/project-form";
import { ProjectLink as Link } from "@/features/projects/project-link";
import { chooseClients, getProject } from "@/features/projects/service";
import { projectPageData } from "@/features/projects/web";
export const metadata = { title: "Edit project" };
export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { initial, choices } = await projectPageData(`/app/projects/${id}/edit`, async (c, token) => ({ initial: await getProject(c, token, id), choices: await chooseClients(c, token) }));
  return <><Link className="text-link client-back" href={`/app/projects/${id}`}>← Project details</Link><PageHeading eyebrow="Projects" title="Edit project" description={initial.project.name} /><ProjectForm {...{ initial, choices }} /></>;
}
