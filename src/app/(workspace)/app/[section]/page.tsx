import { notFound } from "next/navigation";
import { isSection, sections } from "@/features/workspace/sections";
import { SectionScreen } from "@/features/workspace/section-screen";
import { requirePageUser } from "@/server/auth/web";
import { isReferenceKind } from "@/features/references/model";
import { ReferenceList } from "@/features/references/screens";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return { title: isSection(section) ? sections[section].title : "Not found" };
}
export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { section } = await params;
  await requirePageUser(`/app/${section}`);
  if (!isSection(section)) notFound();
  if (isReferenceKind(section)) return <ReferenceList kind={section} searchParams={searchParams} />;
  return <SectionScreen section={section} />;
}
