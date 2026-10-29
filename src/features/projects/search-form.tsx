"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, FormField, Input } from "@/components/ui";
import type { ClientChoice } from "./service";
import { ClientPicker } from "./client-picker";

export function ProjectSearchForm({ query, choices, filteredClient }: { query: { q: string; status: string; clientId: string | null }; choices: ClientChoice[]; filteredClient: ClientChoice | null }) {
  const [busy, setBusy] = useState(false), [selected, setSelected] = useState(filteredClient);
  return <form action="/app/projects" method="get" onSubmit={() => setBusy(true)} aria-busy={busy}><div className="client-form-grid"><FormField label="Kërkoni projektin, vendin ose klientin" htmlFor="projects-search"><Input type="search" id="projects-search" name="q" maxLength={100} defaultValue={query.q} /></FormField><FormField label="Filtri i gjendjes" htmlFor="projects-status"><select className="input" id="projects-status" name="status" defaultValue={query.status}><option value="all">Të gjitha gjendjet</option><option value="active">Aktiv</option><option value="suspended">Pezulluar</option><option value="completed">Përfunduar</option></select></FormField></div><details className="project-client-filter"><summary>Filtroni sipas klientit</summary><ClientPicker choices={choices} selected={selected} onSelect={setSelected} optional /></details><div className="client-actions"><Button type="submit" disabled={busy}>{busy ? "Duke kërkuar…" : "Kërkoni projekte"}</Button><Link className="text-link" href="/app/projects">Pastroni filtrat</Link></div></form>;
}
