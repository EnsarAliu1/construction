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
    } catch (error) { setMessage(error instanceof Error && error.message.startsWith("Shkruani ") ? error.message : "Ruajtja dështoi. Të dhënat tuaja janë mbajtur në formular; provoni përsëri."); }
    finally { if (!saved) { inFlight.current = false; setBusy(false); requestAnimationFrame(() => alertRef.current?.focus()); } }
  }
  return <Card><form onSubmit={save} aria-busy={busy}>{message && <div ref={alertRef} role="alert" tabIndex={-1} className="client-alert client-alert-error"><p>{message}</p>{conflict && <a className="text-link" href={initial ? `/app/projects/${initial.project.id}/edit` : "/app/projects/new"}>Ringarkoni të dhënat e fundit</a>}{unauthorized && <Link className="text-link" href="/administrata">Hyni përsëri</Link>}</div>}{initial?.client.deletedAt && <p className="client-alert">Klienti aktual është arkivuar. Zgjidhni klient aktiv për të përditësuar ose riaktivizuar projektin.</p>}<fieldset className="client-fieldset" disabled={busy}><legend className="sr-only">Detajet e projektit</legend><ClientPicker choices={choices} selected={selected} onSelect={setSelected} /><div className="client-form-grid">
    {([['name',"Emri i projektit (i detyrueshëm)",200],['location',"Vendi / Lokacioni (opsional)",255],['startDate',"Data e fillimit (opsionale)",10],['endDate',"Data e përfundimit (opsionale)",10]] as const).map(([key,label,max]) => <FormField key={key} htmlFor={`project-${key}`} label={label}><Input id={`project-${key}`} name={key} type={key.endsWith("Date") ? "date" : "text"} required={key === "name"} maxLength={max} min={key.endsWith("Date") ? "1000-01-01" : undefined} max={key.endsWith("Date") ? "9999-12-31" : undefined} value={fields[key]} onChange={event => setFields(current => ({ ...current, [key]: event.target.value }))} /></FormField>)}
    <FormField label="Gjendja e projektit (e detyrueshme)" htmlFor="project-status"><select id="project-status" name="status" className="input" value={fields.status} onChange={event => setFields(current => ({ ...current, status: event.target.value as typeof fields.status }))}><option value="active">Aktiv</option><option value="suspended">Pezulluar</option><option value="completed">Përfunduar</option></select></FormField></div>{!initial && <ContractFields {...{ total, setTotal, phases, setPhases }} />}<div className="client-actions"><Button type="submit">{busy ? "Duke ruajtur…" : initial ? "Ruani ndryshimet e projektit" : "Krijoni projektin dhe kontratën"}</Button>{!busy && <Link className="text-link" href={initial ? `/app/projects/${initial.project.id}` : "/app/projects"}>Anuloni</Link>}</div></fieldset><p role="status" className="sr-only">{busy ? "Duke ruajtur projektin. Ju lutemi, prisni." : ""}</p></form></Card>;
}
