"use client";
import {ActionDialog} from '@/components/workspace/action-dialog';

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function ArchiveControl({ id, version, name, blocked }: { id: string; version: number; name: string; blocked: boolean }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  async function archive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !confirmed || blocked) return;
    inFlight.current = true; setBusy(true); setMessage("");
    let archived = false;
    try {
      const response = await fetch(`/api/clients/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, confirmation: "archive" }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "Klienti nuk mund të arkivohet."); return; }
      archived = true; router.push(`/app/clients/${id}?notice=archived`); router.refresh();
    } catch { setMessage("Lidhja dështoi. Provoni përsëri."); }
    finally { if (!archived) { inFlight.current = false; setBusy(false); } }
  }
  return <ActionDialog title="Arkivoni klientin">
    <p>Arkivimi e heq {name} nga lista e klientëve aktivë. Identiteti, lidhjet me projektet dhe historiku ruhen. Rikthimi nuk është i disponueshëm.</p>
    {blocked ? <p className="client-alert" role="status">Ky klient ka projekt aktiv ose të pezulluar dhe nuk mund të arkivohet.</p> : <form onSubmit={archive} aria-busy={busy}>
      <label className="client-checkbox"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} required />E kuptoj dhe dëshiroj ta arkivoj këtë klient.</label>
      <Button type="submit" disabled={!confirmed || busy}>{busy ? "Duke arkivuar…" : "Konfirmoni arkivimin"}</Button>
      {message && <div role="alert" className="client-alert client-alert-error"><p>{message}</p><a href={`/app/clients/${id}`} className="text-link">Ringarkoni klientin</a><Link href={`/administrata?returnTo=${encodeURIComponent(`/app/clients/${id}`)}`} className="text-link">Hyni përsëri</Link></div>}
    </form>}
  </ActionDialog>;
}
