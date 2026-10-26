"use client";

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
      if (!response.ok) { setMessage(result.message ?? "Unable to archive this client."); return; }
      archived = true; router.push(`/app/clients/${id}?notice=archived`); router.refresh();
    } catch { setMessage("Unable to connect. Please try again."); }
    finally { if (!archived) { inFlight.current = false; setBusy(false); } }
  }
  return <details className="client-archive"><summary>Archive client</summary>
    <p>Archiving removes {name} from the active clients list. Its identity, project references and audit history are retained. There is no restore action.</p>
    {blocked ? <p className="client-alert" role="status">This client has an active or suspended project and cannot be archived.</p> : <form onSubmit={archive} aria-busy={busy}>
      <label className="client-checkbox"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} required />I understand and want to archive this client.</label>
      <Button type="submit" disabled={!confirmed || busy}>{busy ? "Archiving…" : "Confirm archive"}</Button>
      {message && <div role="alert" className="client-alert client-alert-error"><p>{message}</p><a href={`/app/clients/${id}`} className="text-link">Reload client</a><Link href={`/login?returnTo=${encodeURIComponent(`/app/clients/${id}`)}`} className="text-link">Sign in again</Link></div>}
    </form>}
  </details>;
}
