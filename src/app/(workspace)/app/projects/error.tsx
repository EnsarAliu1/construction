"use client";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
export default function ProjectsError({ reset }: { reset: () => void }) { return <Card><div role="alert" className="client-alert client-alert-error"><h2>Unable to load project records</h2><p>Project records are temporarily unavailable. Please try again.</p></div><div className="client-actions"><Button onClick={reset}>Try again</Button><Link className="text-link" href="/app/projects">Projects</Link></div></Card>; }
