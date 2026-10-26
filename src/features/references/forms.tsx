"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, FormField, Input } from "@/components/ui";
import { referenceDefinitions, type ReferenceKind, type ReferenceRecord } from "./model";

export function ReferenceForm({ kind, record }: { kind: ReferenceKind; record?: ReferenceRecord }) {
  const definition = referenceDefinitions[kind], router = useRouter(), inFlight = useRef(false), formRef = useRef<HTMLFormElement>(null), alertRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(definition.fields.map(field => [field.key, record?.[field.key] ?? ""])));
  const [errors, setErrors] = useState<Record<string, string>>({}), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [conflict, setConflict] = useState(false), [unauthorized, setUnauthorized] = useState(false);
  const path = `/app/${kind}${record ? `/${record.id}/edit` : "/new"}`;
  async function save(event: FormEvent) {
    event.preventDefault(); if (inFlight.current) return; inFlight.current = true; setBusy(true); setMessage(""); setErrors({}); setConflict(false); setUnauthorized(false); let saved = false;
    try {
      const response = await fetch(`/api/references/${kind}${record ? `/${record.id}` : ""}`, { method: record ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record ? { version: record.version, record: values } : values) });
      const body = await response.json();
      if (!response.ok) { setMessage(body.message ?? "Unable to save this record."); setErrors(body.fields ?? {}); setConflict(body.code === "CONFLICT"); setUnauthorized(response.status === 401); return; }
      saved = true; router.push(`/app/${kind}/${body.record.id}?notice=${record ? "updated" : "created"}`); router.refresh();
    } catch { setMessage("Unable to connect. Your entries have been kept; please retry."); }
    finally { if (!saved) { inFlight.current = false; setBusy(false); requestAnimationFrame(() => ((formRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null) ?? alertRef.current)?.focus()); } }
  }
  return <Card><form ref={formRef} onSubmit={save} aria-busy={busy}>{message && <div ref={alertRef} tabIndex={-1} role="alert" className="client-alert client-alert-error"><p>{message}</p>{conflict && <a className="text-link" href={path}>Reload latest record</a>}{unauthorized && <Link className="text-link" href={`/login?returnTo=${encodeURIComponent(path)}`}>Sign in again</Link>}</div>}{record && !record.isActive && <p className="client-alert">This record is inactive. Editing its information does not reactivate it.</p>}
    <p className="muted client-form-note">Only fields marked required are mandatory. Use plain text; optional blank values are cleared when saved.</p>{kind === "categories" && <p className="muted client-form-note">Category names cannot duplicate existing records, including inactive categories.</p>}{kind === "vehicles" && <p className="muted client-form-note">An identifier is required and must distinguish this registered vehicle. No country-specific registration format is required.</p>}
    <fieldset className="client-fieldset" disabled={busy}><legend className="sr-only">{definition.title} information</legend><div className="client-form-grid">{definition.fields.map(field => <FormField key={field.key} htmlFor={`reference-${field.key}`} label={`${field.label}${field.required ? " (required)" : " (optional)"}`}><Input id={`reference-${field.key}`} name={field.key} type={field.type ?? "text"} required={field.required} maxLength={field.max} value={values[field.key]} onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key] ? `reference-${field.key}-error` : undefined} />{errors[field.key] && <p className="client-field-error" id={`reference-${field.key}-error`}>{errors[field.key]}</p>}</FormField>)}</div><div className="client-actions"><Button type="submit">{busy ? "Saving…" : record ? "Save changes" : `Create ${definition.singular}`}</Button>{!busy && <Link className="text-link" href={`/app/${kind}${record ? `/${record.id}` : ""}`}>Cancel</Link>}</div></fieldset><p className="sr-only" role="status">{busy ? "Saving record. Please wait." : ""}</p></form></Card>;
}

export function ReferenceLifecycle({ kind, record }: { kind: ReferenceKind; record: ReferenceRecord }) {
  const router = useRouter(), inFlight = useRef(false); const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const action = record.isActive ? "deactivate" : "reactivate", label = record.isActive ? "Deactivate" : "Reactivate";
  async function submit(event: FormEvent) {
    event.preventDefault(); if (inFlight.current || !confirmed) return; inFlight.current = true; setBusy(true); setMessage(""); let saved = false;
    try {
      const response = await fetch(`/api/references/${kind}/${record.id}/lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: record.version, action, confirmation: action }) });
      const body = await response.json(); if (!response.ok) { setMessage(body.message); return; }
      saved = true; router.push(`/app/${kind}/${record.id}?notice=${record.isActive ? "deactivated" : "reactivated"}`); router.refresh();
    } catch { setMessage("Unable to connect. Please retry."); } finally { if (!saved) { inFlight.current = false; setBusy(false); } }
  }
  return <details className="client-archive"><summary>{label} record</summary><p>{record.isActive ? "Deactivation excludes this record from future active selectors. Its identity, information and all historical expense references remain." : "Reactivation makes the same record available in active selectors again. Its identity and previous history are preserved."}</p><form onSubmit={submit} aria-busy={busy}><label className="client-checkbox"><input type="checkbox" required disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm that I want to {action} this record.</label><Button type="submit" disabled={!confirmed || busy}>{busy ? "Saving status…" : `Confirm ${action}`}</Button>{message && <div role="alert" className="client-alert client-alert-error"><p>{message}</p><a className="text-link" href={`/app/${kind}/${record.id}`}>Reload record</a><Link className="text-link" href={`/login?returnTo=${encodeURIComponent(`/app/${kind}/${record.id}`)}`}>Sign in again</Link></div>}<p className="sr-only" role="status">{busy ? "Saving lifecycle change." : ""}</p></form></details>;
}

export function ReferenceSearchForm({ kind, query }: { kind: ReferenceKind; query: { q: string; status: string } }) {
  const [busy, setBusy] = useState(false);
  return <form action={`/app/${kind}`} method="get" className="client-filters" onSubmit={() => setBusy(true)} aria-busy={busy}><FormField htmlFor="reference-search" label={`Search ${referenceDefinitions[kind].title.toLowerCase()}`}><Input id="reference-search" name="q" type="search" maxLength={100} defaultValue={query.q} /></FormField><FormField htmlFor="reference-status" label="Status filter"><select className="input" id="reference-status" name="status" defaultValue={query.status}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All records</option></select></FormField><div className="client-actions"><Button type="submit" disabled={busy}>{busy ? "Searching…" : "Search"}</Button><Link className="text-link" href={`/app/${kind}`}>Clear filters</Link><span className="sr-only" role="status">{busy ? "Loading matching records." : ""}</span></div></form>;
}
