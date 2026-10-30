"use client";

import Link from "next/link";
import {useFilterNavigation} from '@/components/workspace/use-filter-navigation';
import { Button, FormField, Input } from "@/components/ui";
import type { ClientQuery } from "./validation";

export function ClientSearchForm({ query }: { query: ClientQuery }) {
  const {form,pending:busy,onSubmit,onInput}=useFilterNavigation('/app/clients');
  return <form action="/app/clients" method="get" className="client-filters" ref={form} onSubmit={onSubmit} onInput={onInput} aria-busy={busy}>
    <FormField label="Kërkoni klientë" htmlFor="clients-search"><Input id="clients-search" name="q" type="search" maxLength={100} defaultValue={query.q} placeholder="Emri, emaili, telefoni, NUI, qyteti ose rruga" /></FormField>
    <FormField label="Lloji i klientit" htmlFor="clients-type"><select className="input" id="clients-type" name="type" defaultValue={query.type}><option value="all">Të gjitha llojet</option><option value="private_person">Individë</option><option value="business">Biznese</option></select></FormField>
    <div className="client-actions"><Button type="submit" disabled={busy}>{busy ? "Duke kërkuar…" : "Kërkoni"}</Button>{(query.q || query.type !== "all") && <Link href="/app/clients" className="text-link">Pastroni filtrat</Link>}<span className="sr-only" role="status">{busy ? "Duke ngarkuar klientët. Ju lutemi, prisni." : ""}</span></div>
  </form>;
}
