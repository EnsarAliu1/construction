"use client";
import { useState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import type { ClientChoice } from "./service";

export function ClientPicker({ choices, selected, onSelect, optional = false }: { choices: ClientChoice[]; selected: ClientChoice | null; onSelect: (value: ClientChoice | null) => void; optional?: boolean }) {
  const [rows, setRows] = useState(choices), [q, setQ] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function search() {
    if (busy) return;
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/projects/clients?q=${encodeURIComponent(q)}`); const body = await response.json(); if (!response.ok) { setMessage(body.message); return; } setRows(body.rows); if (!body.rows.length) setMessage("No active clients match this search."); }
    catch { setMessage("Client search is unavailable. Please retry."); } finally { setBusy(false); }
  }
  const options = selected && !rows.some(row => row.id === selected.id) ? [selected, ...rows] : rows;
  return <div className="project-client-picker"><FormField label="Find client by name" htmlFor="project-client-search"><div className="project-client-search"><Input id="project-client-search" type="search" maxLength={100} value={q} onChange={event => setQ(event.target.value)} /><Button type="button" disabled={busy} onClick={search}>{busy ? "Searching…" : "Find client"}</Button></div></FormField>
    <FormField label={optional ? "Client filter" : "Client (required)"} htmlFor="project-client"><select className="input" id="project-client" name="clientId" required={!optional} value={selected?.id ?? ""} onChange={event => onSelect(options.find(row => row.id === event.target.value) ?? null)}><option value="">{optional ? "All clients" : "Select an active client"}</option>{options.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select><p className="muted client-field-hint">Up to 20 matching active clients. Search to find another client.</p></FormField>{message && <p role="status" className="client-alert">{message}</p>}</div>;
}
