"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, FormField, Input } from "@/components/ui";
import { ClientPicker } from "./client-picker";
import { ContractFields, emptyPhase, phasePayload } from "./contract-editor";
import { inputMoney } from "./money";
import type { ClientChoice, ProjectDetail } from "./service";

export function ProjectForm({ choices, initial }: { choices: ClientChoice[]; initial?: ProjectDetail }) {
  const router = useRouter(), inFlight = useRef(false), alertRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ClientChoice | null>(initial?.client ?? null);
  const [fields, setFields] = useState({ name: initial?.project.name ?? "", location: initial?.project.location ?? "", startDate: initial?.project.startDate ?? "", endDate: initial?.project.endDate ?? "", status: initial?.project.status ?? "active" });
  const [total, setTotal] = useState("0.00"), [phases, setPhases] = useState([emptyPhase("initial")]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [conflict, setConflict] = useState(false), [unauthorized, setUnauthorized] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (inFlight.current) return; inFlight.current = true; setBusy(true); setMessage(""); setConflict(false); let saved = false;
    try {
      const project = { ...fields, clientId: selected?.id, clientVersion: selected?.version };
      const response = await fetch(initial ? `/api/projects/${initial.project.id}` : "/api/projects", { method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(initial ? { project, version: initial.project.version } : { project, contract: { totalValue: inputMoney(total), phases: phasePayload(phases) } }) });
      const result = await response.json(); if (!response.ok) { setMessage(result.message); setConflict(result.code === "CONFLICT"); setUnauthorized(response.status === 401); return; }
      saved = true; router.push(`/app/projects/${result.project.id}?notice=${initial ? "updated" : "created"}`); router.refresh();
    } catch (error) { setMessage(error instanceof Error && error.message.startsWith("Enter ") ? error.message : "Unable to save. Your entries have been kept; please retry."); }
    finally { if (!saved) { inFlight.current = false; setBusy(false); requestAnimationFrame(() => alertRef.current?.focus()); } }
  }
  return <Card><form onSubmit={save} aria-busy={busy}>{message && <div ref={alertRef} role="alert" tabIndex={-1} className="client-alert client-alert-error"><p>{message}</p>{conflict && <a className="text-link" href={initial ? `/app/projects/${initial.project.id}/edit` : "/app/projects/new"}>Reload latest records</a>}{unauthorized && <Link className="text-link" href="/login">Sign in again</Link>}</div>}{initial?.client.deletedAt && <p className="client-alert">The current client is archived. Select an active client to update or reactivate this project.</p>}<fieldset className="client-fieldset" disabled={busy}><legend className="sr-only">Project details</legend><ClientPicker choices={choices} selected={selected} onSelect={setSelected} /><div className="client-form-grid">
    {([['name','Project name (required)',200],['location','Site / location (optional)',255],['startDate','Start date (optional)',10],['endDate','End date (optional)',10]] as const).map(([key,label,max]) => <FormField key={key} htmlFor={`project-${key}`} label={label}><Input id={`project-${key}`} name={key} type={key.endsWith("Date") ? "date" : "text"} required={key === "name"} maxLength={max} min={key.endsWith("Date") ? "1000-01-01" : undefined} max={key.endsWith("Date") ? "9999-12-31" : undefined} value={fields[key]} onChange={event => setFields(current => ({ ...current, [key]: event.target.value }))} /></FormField>)}
    <FormField label="Project status (required)" htmlFor="project-status"><select id="project-status" name="status" className="input" value={fields.status} onChange={event => setFields(current => ({ ...current, status: event.target.value as typeof fields.status }))}><option value="active">Active</option><option value="suspended">Suspended</option><option value="completed">Completed</option></select></FormField></div>{!initial && <ContractFields {...{ total, setTotal, phases, setPhases }} />}<div className="client-actions"><Button type="submit">{busy ? "Saving…" : initial ? "Save project changes" : "Create project & contract"}</Button>{!busy && <Link className="text-link" href={initial ? `/app/projects/${initial.project.id}` : "/app/projects"}>Cancel</Link>}</div></fieldset><p role="status" className="sr-only">{busy ? "Saving project. Please wait." : ""}</p></form></Card>;
}
