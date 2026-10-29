import { PageHeading } from "@/components/ui";
import { ProjectForm } from "@/features/projects/project-form";
import { ProjectLink as Link } from "@/features/projects/project-link";
import { chooseClients } from "@/features/projects/service";
import { projectPageData } from "@/features/projects/web";
export const metadata = { title: "Projekt i ri" };
export default async function NewProjectPage() {
  const choices = await projectPageData("/app/projects/new", (c, token) => chooseClients(c, token));
  return <><Link className="text-link client-back" href="/app/projects">← Projektet</Link><PageHeading eyebrow="Projektet" title="Projekt i ri" description="Krijoni së bashku projektin, kontratën fillestare dhe fazat financiare me shuma të përputhshme." /><ProjectForm choices={choices} /></>;
}
