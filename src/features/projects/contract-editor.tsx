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
  let sum = "Shumë e pavlefshme", difference = "Shkruani shuma të vlefshme";
  try { const amount = active.reduce((sum, phase) => sum + cents(inputMoney(phase.value)), BigInt(0)); sum = decimal(amount); difference = decimal(cents(inputMoney(total)) - amount); } catch { /* Incomplete edits are allowed until Save. */ }
  function change(key: string, field: "name" | "description" | "value", value: string) { setPhases(phases.map(phase => phase.key === key ? { ...phase, [field]: value } : phase)); }
  function move(key: string, direction: number) { const rows = [...active]; const from = rows.findIndex(row => row.key === key), to = from + direction; if (to < 0 || to >= rows.length) return; [rows[from], rows[to]] = [rows[to], rows[from]]; setPhases([...rows, ...phases.filter(row => row.removed)]); }
  return <section className="project-contract-fields"><h2>Kontrata dhe fazat financiare</h2><p className="muted client-form-note">Të gjitha shumat janë në EUR. Fazat janë pjesë financiare, jo progres fizik. Ndryshoni kontratën dhe fazat përfundimtare, pastaj ruajini së bashku.</p>
    <FormField label="Vlera e kontratës (EUR, e detyrueshme)" htmlFor="contract-total"><Input id="contract-total" name="totalValue" required inputMode="decimal" maxLength={20} value={total} onChange={event => setTotal(event.target.value)} /></FormField>
    <div className="project-total-summary" aria-live="polite"><p>Shuma e fazave aktive: <strong>{sum} EUR</strong></p><p>Kontrata minus fazat: <strong>{difference}{difference !== "Shkruani shuma të vlefshme" ? " EUR" : ""}</strong></p><p className="muted">Diferenca duhet të jetë 0.00 EUR. Vlerat nuk përshtaten automatikisht.</p></div>
    {active.map((phase, index) => <section className="project-phase-editor" key={phase.key} aria-labelledby={`phase-heading-${index}`}><div className="section-title"><h3 id={`phase-heading-${index}`}>Faza {index + 1}</h3><div className="client-actions"><Button className="client-secondary project-small-button" type="button" onClick={() => move(phase.key, -1)} disabled={index === 0} aria-label={`Lëvizni fazën ${index + 1} lart`}>Lart</Button><Button className="client-secondary project-small-button" type="button" onClick={() => move(phase.key, 1)} disabled={index === active.length - 1} aria-label={`Lëvizni fazën ${index + 1} poshtë`}>Poshtë</Button></div></div>
      <div className="client-form-grid"><FormField label="Emri i fazës (i detyrueshëm)" htmlFor={`phase-name-${index}`}><Input id={`phase-name-${index}`} required maxLength={200} value={phase.name} onChange={event => change(phase.key, "name", event.target.value)} /></FormField><FormField label="Vlera e fazës (EUR, e detyrueshme)" htmlFor={`phase-value-${index}`}><Input id={`phase-value-${index}`} required inputMode="decimal" maxLength={20} value={phase.value} onChange={event => change(phase.key, "value", event.target.value)} /></FormField></div>
      <FormField label="Përshkrimi (opsional)" htmlFor={`phase-description-${index}`}><textarea className="input" id={`phase-description-${index}`} maxLength={65535} rows={2} value={phase.description} onChange={event => change(phase.key, "description", event.target.value)} /></FormField>
      <p className="muted">Pagesat aktive: {phase.paid} EUR{phase.id ? " (rikontrollohet gjatë ruajtjes)" : " (fazë e re)"}.</p><Button type="button" className="client-secondary project-small-button" disabled={cents(phase.paid) > BigInt(0)} onClick={() => setPhases(phase.id ? phases.map(row => row.key === phase.key ? { ...row, removed: true } : row) : phases.filter(row => row.key !== phase.key))}>Hiqni fazën {index + 1}</Button>{cents(phase.paid) > BigInt(0) && <p className="muted">Ndarjet aktive pengojnë heqjen.</p>}
    </section>)}
    {phases.filter(phase => phase.removed).map(phase => <div className="client-alert" key={phase.key}><p>Në pritje të heqjes: {phase.name}. Historiku dhe lidhjet ruhen. Përshtatni shumën ose fazat e tjera për të ruajtur barazinë.</p><Button type="button" className="client-secondary" onClick={() => setPhases(phases.map(row => row.key === phase.key ? { ...row, removed: false } : row))}>Zhbëni heqjen</Button></div>)}
    <Button type="button" className="client-secondary" disabled={active.length >= MAX_PHASES} onClick={() => setPhases([...phases, emptyPhase(crypto.randomUUID())])}>Shtoni fazë financiare</Button><p className="muted client-form-note">Deri në {MAX_PHASES} faza aktive. Ndryshimet ruhen vetëm pasi të klikoni Ruani.</p>
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
    } catch (error) { setMessage(error instanceof Error && error.message.startsWith("Shkruani ") ? error.message : "Ruajtja dështoi. Ndryshimet tuaja janë mbajtur në formular; provoni përsëri."); }
    finally { if (!saved) { inFlight.current = false; setBusy(false); requestAnimationFrame(() => alertRef.current?.focus()); } }
  }
  if (detail.contract?.status === "cancelled") return <Card><p className="client-alert">Kontratat e anuluara ruhen vetëm për shikim. Rikthimi nuk përfshihet në këtë proces.</p></Card>;
  return <Card><form onSubmit={save} aria-busy={busy}>{message && <div ref={alertRef} tabIndex={-1} role="alert" className="client-alert client-alert-error"><p>{message}</p>{conflict && <a className="text-link" href={`/app/projects/${detail.project.id}/contract`}>Ringarkoni kontratën e fundit</a>}{unauthorized && <Link className="text-link" href={`/administrata?returnTo=${encodeURIComponent(`/app/projects/${detail.project.id}/contract`)}`}>Hyni përsëri</Link>}</div>}{(!detail.contract || detail.contract.status === "draft") && <p className="client-alert">Ruajtja krijon ose aktivizon kontratën me vlerat përfundimtare të përputhshme të fazave.</p>}<fieldset className="client-fieldset" disabled={busy}><legend className="sr-only">Formulari i përbashkët i kontratës dhe fazave</legend><ContractFields {...{ total, setTotal, phases, setPhases }} /><div className="client-actions"><Button type="submit">{busy ? "Duke ruajtur…" : "Ruani kontratën dhe fazat"}</Button>{!busy && <Link className="text-link" href={`/app/projects/${detail.project.id}`}>Anuloni</Link>}</div></fieldset><p className="sr-only" role="status">{busy ? "Duke ruajtur kontratën dhe fazat së bashku." : ""}</p></form></Card>;
}
