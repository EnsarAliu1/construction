import { ReferenceDetails } from "@/features/references/screens";
export const metadata = { title: "Reference record" };
export default async function ReferencePage({ params, searchParams }: { params: Promise<{ section: string; id: string }>; searchParams: Promise<{ notice?: string }> }) { const { section,id } = await params; return <ReferenceDetails {...{ section,id,searchParams }} />; }
