"use client";

import Link from "next/link";
import { Button, Card } from "@/components/ui";

export default function ClientsError({ reset }: { reset: () => void }) {
  return <Card><div role="alert" className="client-alert client-alert-error"><h2>Unable to load clients</h2><p>Client records are temporarily unavailable. Please try again.</p></div><div className="client-actions"><Button onClick={() => reset()}>Try again</Button><Link href="/app/clients" className="text-link">Clients list</Link></div></Card>;
}
