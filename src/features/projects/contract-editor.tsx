"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, FormField, Input } from "@/components/ui";
import type { ProjectDetail } from "./service";
import { cents, decimal, inputMoney } from "./money";
import { MAX_PHASES } from "./validation";

export type PhaseDraft = { key: string; id?: string; version?: number; name: string; description: string; value: string; paid: string; removed: boolean };
export const emptyPhase = (key: string): PhaseDraft => ({ key, name: "", description: "", value: "0.00", paid: "0.00", removed: false });
export function phaseDrafts(detail: ProjectDetail): PhaseDraft[] { return detail.phases.map(phase => ({ key: phase.id, id: phase.id, version: phase.version, name: phase.name, description: phase.description ?? "", value: phase.value, paid: phase.paid, removed: false })); }
export function phasePayload(phases: PhaseDraft[]) { return phases.filter(phase => !phase.removed).map((phase, index) => ({ ...(phase.id ? { id: phase.id, version: phase.version } : {}), name: phase.name, description: phase.description || null, value: inputMoney(phase.value), sortOrder: index })); }

export function ContractFields({ total, setTotal, phases, setPhases }: { total: string; setTotal: (value: string) => void; phases: PhaseDraft[]; setPhases: (value: PhaseDraft[]) => void }) {
  const active = phases.filter(phase => !phase.removed);
  let sum = "Invalid amount", difference = "Enter valid amounts";
  try { const amount = active.reduce((sum, phase) => sum + cents(inputMoney(phase.value)), BigInt(0)); sum = decimal(amount); difference = decimal(cents(inputMoney(total)) - amount); } catch { /* Incomplete edits are allowed until Save. */ }
  function change(key: string, field: "name" | "description" | "value", value: string) { setPhases(phases.map(phase => phase.key === key ? { ...phase, [field]: value } : phase)); }
  function move(key: string, direction: number) { const rows = [...active]; const from = rows.findIndex(row => row.key === key), to = from + direction; if (to < 0 || to >= rows.length) return; [rows[from], rows[to]] = [rows[to], rows[from]]; setPhases([...rows, ...phases.filter(row => row.removed)]); }
  return <section className="project-contract-fields"><h2>Contract & financial phases</h2><p className="muted client-form-note">All amounts are EUR. Phases are monetary components, not physical progress. Edit the final contract and phases, then save them together.</p>
    <FormField label="Contract value (EUR, required)" htmlFor="contract-total"><Input id="contract-total" name="totalValue" required inputMode="decimal" maxLength={20} value={total} onChange={event => setTotal(event.target.value)} /></FormField>
    <div className="project-total-summary" aria-live="polite"><p>Active phase total: <strong>{sum} EUR</strong></p><p>Contract minus phases: <strong>{difference}{difference !== "Enter valid amounts" ? " EUR" : ""}</strong></p><p className="muted">The difference must be 0.00 EUR. Values are never adjusted automatically.</p></div>
    {active.map((phase, index) => <section className="project-phase-editor" key={phase.key} aria-labelledby={`phase-heading-${index}`}><div className="section-title"><h3 id={`phase-heading-${index}`}>Phase {index + 1}</h3><div className="client-actions"><Button className="client-secondary project-small-button" type="button" onClick={() => move(phase.key, -1)} disabled={index === 0} aria-label={`Move phase ${index + 1} up`}>Up</Button><Button className="client-secondary project-small-button" type="button" onClick={() => move(phase.key, 1)} disabled={index === active.length - 1} aria-label={`Move phase ${index + 1} down`}>Down</Button></div></div>
      <div className="client-form-grid"><FormField label="Phase name (required)" htmlFor={`phase-name-${index}`}><Input id={`phase-name-${index}`} required maxLength={200} value={phase.name} onChange={event => change(phase.key, "name", event.target.value)} /></FormField><FormField label="Phase value (EUR, required)" htmlFor={`phase-value-${index}`}><Input id={`phase-value-${index}`} required inputMode="decimal" maxLength={20} value={phase.value} onChange={event => change(phase.key, "value", event.target.value)} /></FormField></div>
      <FormField label="Description (optional)" htmlFor={`phase-description-${index}`}><textarea className="input" id={`phase-description-${index}`} maxLength={65535} rows={2} value={phase.description} onChange={event => change(phase.key, "description", event.target.value)} /></FormField>
      <p className="muted">Active paid: {phase.paid} EUR{phase.id ? " (rechecked when saving)" : " (new phase)"}.</p><Button type="button" className="client-secondary project-small-button" disabled={cents(phase.paid) > BigInt(0)} onClick={() => setPhases(phase.id ? phases.map(row => row.key === phase.key ? { ...row, removed: true } : row) : phases.filter(row => row.key !== phase.key))}>Remove phase {index + 1}</Button>{cents(phase.paid) > BigInt(0) && <p className="muted">Active allocations prevent removal.</p>}
    </section>)}
    {phases.filter(phase => phase.removed).map(phase => <div className="client-alert" key={phase.key}><p>Pending removal: {phase.name}. History and references will remain. Adjust the total or other phases to keep equality.</p><Button type="button" className="client-secondary" onClick={() => setPhases(phases.map(row => row.key === phase.key ? { ...row, removed: false } : row))}>Undo removal</Button></div>)}
    <Button type="button" className="client-secondary" disabled={active.length >= MAX_PHASES} onClick={() => setPhases([...phases, emptyPhase(crypto.randomUUID())])}>Add financial phase</Button><p className="muted client-form-note">Up to {MAX_PHASES} active phases. Pending edits are stored only when you Save.</p>
  </section>;
}

export function ContractEditor({ detail }: { detail: ProjectDetail }) {
  const router = useRouter(), inFlight = useRef(false), alertRef = useRef<HTMLDivElement>(null);
  const [total, setTotal] = useState(detail.contract?.totalValue ?? "0.00"), [phases, setPhases] = useState(() => detail.contract ? phaseDrafts(detail) : [emptyPhase("initial")]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [conflict, setConflict] = useState(false), [unauthorized, setUnauthorized] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (inFlight.current) return; inFlight.current = true; setBusy(true); setMessage(""); setConflict(false); let saved = false;
    try {
      const response = await fetch(`/api/projects/${detail.project.id}/contract`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractId: detail.contract?.id ?? null, version: detail.contract?.version ?? null, projectVersion: detail.project.version, totalValue: inputMoney(total), phases: phasePayload(phases), deletedPhases: phases.filter(phase => phase.removed && phase.id).map(phase => ({ id: phase.id, version: phase.version })) }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message); setConflict(result.code === "CONFLICT"); setUnauthorized(response.status === 401); return; }
      saved = true; router.push(`/app/projects/${detail.project.id}?notice=contract`); router.refresh();
    } catch (error) { setMessage(error instanceof Error && error.message.startsWith("Enter ") ? error.message : "Unable to save. Your edits have been kept; please retry."); }
    finally { if (!saved) { inFlight.current = false; setBusy(false); requestAnimationFrame(() => alertRef.current?.focus()); } }
  }
  if (detail.contract?.status === "cancelled") return <Card><p className="client-alert">Cancelled contracts are retained read-only. Restoration is outside this workflow.</p></Card>;
  return <Card><form onSubmit={save} aria-busy={busy}>{message && <div ref={alertRef} tabIndex={-1} role="alert" className="client-alert client-alert-error"><p>{message}</p>{conflict && <a className="text-link" href={`/app/projects/${detail.project.id}/contract`}>Reload latest contract</a>}{unauthorized && <Link className="text-link" href={`/login?returnTo=${encodeURIComponent(`/app/projects/${detail.project.id}/contract`)}`}>Sign in again</Link>}</div>}{(!detail.contract || detail.contract.status === "draft") && <p className="client-alert">Saving creates or activates the contract with the consistent final phase values.</p>}<fieldset className="client-fieldset" disabled={busy}><legend className="sr-only">Combined contract and phases editor</legend><ContractFields {...{ total, setTotal, phases, setPhases }} /><div className="client-actions"><Button type="submit">{busy ? "Saving…" : "Save contract & phases"}</Button>{!busy && <Link className="text-link" href={`/app/projects/${detail.project.id}`}>Cancel</Link>}</div></fieldset><p className="sr-only" role="status">{busy ? "Saving contract and phases together." : ""}</p></form></Card>;
}
