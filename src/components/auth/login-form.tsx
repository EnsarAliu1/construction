"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input } from "@/components/ui";
import {redactLegacyRecoveryDrafts} from "@/features/payments/recovery-key";

export function LoginForm({ returnTo, unavailable }: { returnTo: string; unavailable: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(unavailable ? "Hyrja është përkohësisht e padisponueshme. Provoni më vonë." : "");
  const error = useRef<HTMLParagraphElement>(null);
  useEffect(()=>{try{redactLegacyRecoveryDrafts(sessionStorage);}catch{/* Browser storage may be disabled. */}},[]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password"), returnTo }) });
      const result = await response.json();
      if (response.ok && result.ok) { router.replace(result.returnTo); router.refresh(); return; }
      setMessage("Hyrja dështoi. Kontrolloni të dhënat ose provoni më vonë.");
    } catch { setMessage("Hyrja dështoi. Kontrolloni të dhënat ose provoni më vonë."); }
    setPending(false);
    requestAnimationFrame(() => error.current?.focus());
  }
  return <form onSubmit={submit} aria-busy={pending}>
    <fieldset disabled={pending}>
      <legend className="sr-only">Hyni me llogarinë tuaj personale</legend>
      <FormField label="Emaili" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="username" required maxLength={254} /></FormField>
      <FormField label="Fjalëkalimi" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} /></FormField>
      {message && <p ref={error} role="alert" tabIndex={-1} className="login-error">{message}</p>}
      <Button type="submit" className="login-submit">{pending ? "Duke hyrë…" : "Hyni"}</Button>
    </fieldset>
    <p className="muted login-help">Llogaritë dhe rikuperimi i fjalëkalimit menaxhohen nga Adore. Kontaktoni operatorin e autorizuar për ndihmë.</p>
  </form>;
}
