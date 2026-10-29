"use client";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
export default function SectionError({ reset }: { reset: () => void }) { return <Card><div role="alert" className="client-alert client-alert-error"><h2>Të dhënat nuk mund të ngarkohen</h2><p>Të dhënat janë përkohësisht të padisponueshme. Provoni përsëri.</p></div><div className="client-actions"><Button onClick={reset}>Provoni përsëri</Button><Link href="/app" className="text-link">Hapësira e punës</Link></div></Card>; }
