import { ReferenceCreate } from "@/features/references/screens";
export const metadata = { title: "New reference record" };
export default async function NewReferencePage({ params }: { params: Promise<{ section: string }> }) { return <ReferenceCreate section={(await params).section} />; }
