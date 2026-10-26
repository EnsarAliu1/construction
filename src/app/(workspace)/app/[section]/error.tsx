"use client";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
export default function SectionError({ reset }: { reset: () => void }) { return <Card><div role="alert" className="client-alert client-alert-error"><h2>Unable to load records</h2><p>Records are temporarily unavailable. Please try again.</p></div><div className="client-actions"><Button onClick={reset}>Try again</Button><Link href="/app" className="text-link">Workspace</Link></div></Card>; }
