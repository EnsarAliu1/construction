"use client";

import Link from "next/link";
import { Button, Card } from "@/components/ui";

export default function ClientsError({ reset }: { reset: () => void }) {
  return <Card><div role="alert" className="client-alert client-alert-error"><h2>Klientët nuk mund të ngarkohen</h2><p>Të dhënat e klientëve janë përkohësisht të padisponueshme. Provoni përsëri.</p></div><div className="client-actions"><Button onClick={() => reset()}>Provoni përsëri</Button><Link href="/app/clients" className="text-link">Lista e klientëve</Link></div></Card>;
}
