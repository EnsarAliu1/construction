import { ReferenceCreate } from "@/features/references/screens";
export const metadata = { title: "E dhënë e re referuese" };
export default async function NewReferencePage({ params }: { params: Promise<{ section: string }> }) { return <ReferenceCreate section={(await params).section} />; }
