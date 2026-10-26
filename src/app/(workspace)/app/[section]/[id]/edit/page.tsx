import { ReferenceEdit } from "@/features/references/screens";
export const metadata = { title: "Edit reference record" };
export default async function EditReferencePage({ params }: { params: Promise<{ section: string; id: string }> }) { const { section,id } = await params; return <ReferenceEdit {...{ section,id }} />; }
