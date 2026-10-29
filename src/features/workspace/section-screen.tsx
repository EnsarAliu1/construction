import { Badge, PageHeading, TableShell } from "@/components/ui";
import { sections, type SectionKey } from "./sections";

export function SectionScreen({ section }: { section: SectionKey }) {
  const content = sections[section];
  return <>
    <PageHeading eyebrow="Hapësira e punës" title={content.title} description={content.description}><Badge>Pamja e ndërfaqes</Badge></PageHeading>
    <TableShell caption={content.title} columns={content.columns} emptyTitle={content.empty}
      emptyDescription="Kjo është pamje bosh e ndërfaqes. Të dhënat dhe veprimet do të jenë të disponueshme në vazhdim." />
  </>;
}
