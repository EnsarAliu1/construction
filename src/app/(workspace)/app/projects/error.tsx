"use client";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
export default function ProjectsError({ reset }: { reset: () => void }) { return <Card><div role="alert" className="client-alert client-alert-error"><h2>Projektet nuk mund të ngarkohen</h2><p>Projektet janë përkohësisht të padisponueshme. Provoni përsëri.</p></div><div className="client-actions"><Button onClick={reset}>Provoni përsëri</Button><Link className="text-link" href="/app/projects">Projektet</Link></div></Card>; }
