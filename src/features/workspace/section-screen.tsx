import { Badge, PageHeading, TableShell } from "@/components/ui";
import { sections, type SectionKey } from "./sections";

export function SectionScreen({ section }: { section: SectionKey }) {
  const content = sections[section];
  return <>
    <PageHeading eyebrow="Workspace" title={content.title} description={content.description}><Badge>Interface preview</Badge></PageHeading>
    <TableShell caption={content.title} columns={content.columns} emptyTitle={content.empty}
      emptyDescription="This is an empty interface preview. Records and actions will become available in a later work package." />
  </>;
}
