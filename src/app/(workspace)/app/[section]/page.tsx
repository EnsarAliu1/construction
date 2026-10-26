import { notFound } from "next/navigation";
import { isSection, sections } from "@/features/workspace/sections";
import { SectionScreen } from "@/features/workspace/section-screen";

export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(sections).map(section => ({ section })); }
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return { title: isSection(section) ? sections[section].title : "Not found" };
}
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  return <SectionScreen section={section} />;
}
