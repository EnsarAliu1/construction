"use client";
import {valueLabel} from "@/i18n/format";

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
      if (!response.ok) { setMessage(body.message ?? "Të dhënat nuk mund të ruhen."); setErrors(body.fields ?? {}); setConflict(body.code === "CONFLICT"); setUnauthorized(response.status === 401); return; }
      saved = true; router.push(`/app/${kind}/${body.record.id}?notice=${record ? "updated" : "created"}`); router.refresh();
    } catch { setMessage("Lidhja dështoi. Të dhënat tuaja janë ruajtur në formular; provoni përsëri."); }
    finally { if (!saved) { inFlight.current = false; setBusy(false); requestAnimationFrame(() => ((formRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null) ?? alertRef.current)?.focus()); } }
  }
  return <Card><form ref={formRef} onSubmit={save} aria-busy={busy}>{message && <div ref={alertRef} tabIndex={-1} role="alert" className="client-alert client-alert-error"><p>{message}</p>{conflict && <a className="text-link" href={path}>Ringarkoni të dhënat e fundit</a>}{unauthorized && <Link className="text-link" href={`/login?returnTo=${encodeURIComponent(path)}`}>Hyni përsëri</Link>}</div>}{record && !record.isActive && <p className="client-alert">Këto të dhëna janë joaktive. Ndryshimi i tyre nuk i riaktivizon.</p>}
    <p className="muted client-form-note">Vetëm fushat e shënuara janë të detyrueshme. Përdorni tekst të thjeshtë; fushat opsionale bosh pastrohen gjatë ruajtjes.</p>{kind === "categories" && <p className="muted client-form-note">Emrat e kategorive nuk mund të përsëriten, përfshirë kategoritë joaktive.</p>}{kind === "vehicles" && <p className="muted client-form-note">Identifikuesi është i detyrueshëm dhe duhet ta dallojë këtë automjet. Nuk kërkohet format regjistrimi i një shteti të caktuar.</p>}
    <fieldset className="client-fieldset" disabled={busy}><legend className="sr-only">{definition.title} të dhënat</legend><div className="client-form-grid">{definition.fields.map(field => <FormField key={field.key} htmlFor={`reference-${field.key}`} label={`${field.label}${field.required ? " (e detyrueshme)" : " (opsionale)"}`}><Input id={`reference-${field.key}`} name={field.key} type={field.type ?? "text"} required={field.required} maxLength={field.max} value={values[field.key]} onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key] ? `reference-${field.key}-error` : undefined} />{errors[field.key] && <p className="client-field-error" id={`reference-${field.key}-error`}>{errors[field.key]}</p>}</FormField>)}</div><div className="client-actions"><Button type="submit">{busy ? "Duke ruajtur…" : record ? "Ruani ndryshimet" : `Krijoni ${definition.singular}`}</Button>{!busy && <Link className="text-link" href={`/app/${kind}${record ? `/${record.id}` : ""}`}>Anuloni</Link>}</div></fieldset><p className="sr-only" role="status">{busy ? "Duke ruajtur të dhënat. Ju lutemi, prisni." : ""}</p></form></Card>;
}

export function ReferenceLifecycle({ kind, record }: { kind: ReferenceKind; record: ReferenceRecord }) {
  const router = useRouter(), inFlight = useRef(false); const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const action = record.isActive ? "deactivate" : "reactivate", label = record.isActive ? "Çaktivizoni" : "Riaktivizoni";
  async function submit(event: FormEvent) {
    event.preventDefault(); if (inFlight.current || !confirmed) return; inFlight.current = true; setBusy(true); setMessage(""); let saved = false;
    try {
      const response = await fetch(`/api/references/${kind}/${record.id}/lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: record.version, action, confirmation: action }) });
      const body = await response.json(); if (!response.ok) { setMessage(body.message); return; }
      saved = true; router.push(`/app/${kind}/${record.id}?notice=${record.isActive ? "deactivated" : "reactivated"}`); router.refresh();
    } catch { setMessage("Lidhja dështoi. Provoni përsëri."); } finally { if (!saved) { inFlight.current = false; setBusy(false); } }
  }
  return <details className="client-archive"><summary>{label} të dhënë</summary><p>{record.isActive ? "Çaktivizimi e përjashton këtë të dhënë nga përzgjedhjet aktive në të ardhmen. Identiteti, informacioni dhe të gjitha lidhjet historike me shpenzimet ruhen." : "Riaktivizimi e bën të njëjtën të dhënë sërish të disponueshme në përzgjedhjet aktive. Identiteti dhe historiku ruhen."}</p><form onSubmit={submit} aria-busy={busy}><label className="client-checkbox"><input type="checkbox" required disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Konfirmoj se dëshiroj të {valueLabel(action)} këto të dhëna.</label><Button type="submit" disabled={!confirmed || busy}>{busy ? "Duke ruajtur gjendjen…" : `Konfirmoni ${record.isActive ? "çaktivizimin" : "riaktivizimin"}`}</Button>{message && <div role="alert" className="client-alert client-alert-error"><p>{message}</p><a className="text-link" href={`/app/${kind}/${record.id}`}>Ringarkoni të dhënat</a><Link className="text-link" href={`/login?returnTo=${encodeURIComponent(`/app/${kind}/${record.id}`)}`}>Hyni përsëri</Link></div>}<p className="sr-only" role="status">{busy ? "Duke ruajtur ndryshimin e gjendjes." : ""}</p></form></details>;
}

export function ReferenceSearchForm({ kind, query }: { kind: ReferenceKind; query: { q: string; status: string } }) {
  const [busy, setBusy] = useState(false);
  return <form action={`/app/${kind}`} method="get" className="client-filters" onSubmit={() => setBusy(true)} aria-busy={busy}><FormField htmlFor="reference-search" label={`Kërkoni ${referenceDefinitions[kind].title.toLowerCase()}`}><Input id="reference-search" name="q" type="search" maxLength={100} defaultValue={query.q} /></FormField><FormField htmlFor="reference-status" label="Filtri i gjendjes"><select className="input" id="reference-status" name="status" defaultValue={query.status}><option value="active">Aktiv</option><option value="inactive">Joaktiv</option><option value="all">Të gjitha të dhënat</option></select></FormField><div className="client-actions"><Button type="submit" disabled={busy}>{busy ? "Duke kërkuar…" : "Kërkoni"}</Button><Link className="text-link" href={`/app/${kind}`}>Pastroni filtrat</Link><span className="sr-only" role="status">{busy ? "Duke ngarkuar rezultatet e kërkimit." : ""}</span></div></form>;
}
