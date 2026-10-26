"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import type { ClientQuery } from "./validation";

export function ClientSearchForm({ query }: { query: ClientQuery }) {
  const [busy, setBusy] = useState(false);
  return <form action="/app/clients" method="get" className="client-filters" onSubmit={() => setBusy(true)} aria-busy={busy}>
    <FormField label="Search clients" htmlFor="clients-search"><Input id="clients-search" name="q" type="search" maxLength={100} defaultValue={query.q} placeholder="Name, email, phone, NUI, city or street" /></FormField>
    <FormField label="Client type" htmlFor="clients-type"><select className="input" id="clients-type" name="type" defaultValue={query.type}><option value="all">All types</option><option value="private_person">Individuals</option><option value="business">Businesses</option></select></FormField>
    <div className="client-actions"><Button type="submit" disabled={busy}>{busy ? "Searching…" : "Search"}</Button>{(query.q || query.type !== "all") && <Link href="/app/clients" className="text-link">Clear filters</Link>}<span className="sr-only" role="status">{busy ? "Loading clients. Please wait." : ""}</span></div>
  </form>;
}
