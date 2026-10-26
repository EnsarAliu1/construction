"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input } from "@/components/ui";

export function LoginForm({ returnTo, unavailable }: { returnTo: string; unavailable: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(unavailable ? "Sign-in is temporarily unavailable. Please try again later." : "");
  const error = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password"), returnTo }) });
      const result = await response.json();
      if (response.ok && result.ok) { router.replace(result.returnTo); router.refresh(); return; }
      setMessage("Unable to sign in. Check your details or try again later.");
    } catch { setMessage("Unable to sign in. Check your details or try again later."); }
    setPending(false);
    requestAnimationFrame(() => error.current?.focus());
  }
  return <form onSubmit={submit} aria-busy={pending}>
    <fieldset disabled={pending}>
      <legend className="sr-only">Sign in with your individual account</legend>
      <FormField label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="username" required maxLength={254} /></FormField>
      <FormField label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} /></FormField>
      {message && <p ref={error} role="alert" tabIndex={-1} className="login-error">{message}</p>}
      <Button type="submit" className="login-submit">{pending ? "Signing in…" : "Sign in"}</Button>
    </fieldset>
    <p className="muted login-help">Accounts and password recovery are managed by Adore. Contact your authorized operator for assistance.</p>
  </form>;
}
