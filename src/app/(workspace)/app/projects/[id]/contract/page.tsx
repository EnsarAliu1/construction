import { PageHeading } from "@/components/ui";
import { ContractEditor } from "@/features/projects/contract-editor";
import { ProjectLink as Link } from "@/features/projects/project-link";
import { getProject } from "@/features/projects/service";
import { projectPageData } from "@/features/projects/web";
export const metadata = { title: "Ndryshimi i kontratës dhe fazave" };
export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const detail = await projectPageData(`/app/projects/${id}/contract`, (c, token) => getProject(c, token, id));
  return <><Link className="text-link client-back" href={`/app/projects/${id}`}>← Detajet e projektit</Link><PageHeading eyebrow="Projektet" title="Ndryshimi i kontratës dhe fazave" description={detail.project.name} /><ContractEditor detail={detail} /></>;
}
