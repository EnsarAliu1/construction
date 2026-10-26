"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, FormField, Input } from "@/components/ui";
import type { ClientChoice } from "./service";
import { ClientPicker } from "./client-picker";

export function ProjectSearchForm({ query, choices, filteredClient }: { query: { q: string; status: string; clientId: string | null }; choices: ClientChoice[]; filteredClient: ClientChoice | null }) {
  const [busy, setBusy] = useState(false), [selected, setSelected] = useState(filteredClient);
  return <form action="/app/projects" method="get" onSubmit={() => setBusy(true)} aria-busy={busy}><div className="client-form-grid"><FormField label="Search project, site or client" htmlFor="projects-search"><Input type="search" id="projects-search" name="q" maxLength={100} defaultValue={query.q} /></FormField><FormField label="Status filter" htmlFor="projects-status"><select className="input" id="projects-status" name="status" defaultValue={query.status}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="completed">Completed</option></select></FormField></div><details className="project-client-filter"><summary>Filter by client</summary><ClientPicker choices={choices} selected={selected} onSelect={setSelected} optional /></details><div className="client-actions"><Button type="submit" disabled={busy}>{busy ? "Searching…" : "Search projects"}</Button><Link className="text-link" href="/app/projects">Clear filters</Link></div></form>;
}
