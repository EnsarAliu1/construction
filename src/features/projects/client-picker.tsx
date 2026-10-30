"use client";
import { useState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import type { ClientChoice } from "./service";

export function ClientPicker({ choices, selected, onSelect, optional = false, idPrefix = "project" }: { choices: ClientChoice[]; selected: ClientChoice | null; onSelect: (value: ClientChoice | null) => void; optional?: boolean; idPrefix?: string }) {
  const selectId=`${idPrefix}-client`, searchId=`${idPrefix}-client-search`;
  const [rows, setRows] = useState(choices), [q, setQ] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function search() {
    if (busy) return;
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/projects/clients?q=${encodeURIComponent(q)}`); const body = await response.json(); if (!response.ok) { setMessage(body.message); return; } setRows(body.rows); if (!body.rows.length) setMessage("Nuk u gjetën klientë aktivë sipas këtij kërkimi."); }
    catch { setMessage("Kërkimi i klientëve është i padisponueshëm. Provoni përsëri."); } finally { setBusy(false); }
  }
  const options = selected && !rows.some(row => row.id === selected.id) ? [selected, ...rows] : rows;
  return <div className="project-client-picker"><FormField label="Gjeni klientin sipas emrit" htmlFor={searchId}><div className="project-client-search"><Input id={searchId} type="search" maxLength={100} value={q} onChange={event => setQ(event.target.value)} /><Button type="button" disabled={busy} onClick={search}>{busy ? "Duke kërkuar…" : "Gjeni klientin"}</Button></div></FormField>
    <FormField label={optional ? "Filtri i klientit" : "Klienti (i detyrueshëm)"} htmlFor={selectId}><select className="input" id={selectId} name="clientId" required={!optional} value={selected?.id ?? ""} onChange={event => onSelect(options.find(row => row.id === event.target.value) ?? null)}><option value="">{optional ? "Të gjithë klientët" : "Zgjidhni klient aktiv"}</option>{options.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select><p className="muted client-field-hint">Deri në 20 klientë aktivë sipas kërkimit. Kërkoni për të gjetur klient tjetër.</p></FormField>{message && <p role="status" className="client-alert">{message}</p>}</div>;
}
