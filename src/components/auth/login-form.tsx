"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input } from "@/components/ui";
import {redactLegacyRecoveryDrafts} from "@/features/payments/recovery-key";

export function LoginForm({ returnTo, unavailable }: { returnTo: string; unavailable: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword,setShowPassword]=useState(false);
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
      <FormField label="Emaili" htmlFor="email"><div className="auth-input-wrap"><svg className="auth-input-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg><Input id="email" name="email" type="email" autoComplete="username" placeholder="emri@kompania.com" required maxLength={254} /></div></FormField>
      <FormField label="Fjalëkalimi" htmlFor="password"><div className="auth-input-wrap auth-password-wrap"><svg className="auth-input-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg><Input id="password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder="Fjalëkalimi juaj" required maxLength={1024} /><button className="auth-password-toggle" type="button" aria-controls="password" aria-label={showPassword?'Fshih fjalëkalimin':'Shfaq fjalëkalimin'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword&&<path d="m3 3 18 18"/>}</svg></button></div></FormField>
      {message && <p ref={error} role="alert" tabIndex={-1} className="login-error">{message}</p>}
      <Button type="submit" className="login-submit"><span>{pending ? "Duke verifikuar…" : "Hyni"}</span><span className="auth-submit-arrow" aria-hidden="true">→</span></Button>
    </fieldset>
    <p className="muted login-help">Llogaritë dhe rikuperimi i fjalëkalimit menaxhohen nga Adore. Kontaktoni operatorin e autorizuar për ndihmë.</p>
  </form>;
}
