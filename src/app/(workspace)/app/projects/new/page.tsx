import { PageHeading } from "@/components/ui";
import { ProjectForm } from "@/features/projects/project-form";
import { ProjectLink as Link } from "@/features/projects/project-link";
import { chooseClients } from "@/features/projects/service";
import { projectPageData } from "@/features/projects/web";
export const metadata = { title: "New project" };
export default async function NewProjectPage() {
  const choices = await projectPageData("/app/projects/new", (c, token) => chooseClients(c, token));
  return <><Link className="text-link client-back" href="/app/projects">← Projects</Link><PageHeading eyebrow="Projects" title="New project" description="Create project details, an initial contract and consistent financial phases together." /><ProjectForm choices={choices} /></>;
}
