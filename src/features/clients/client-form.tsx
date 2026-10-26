"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, FormField, Input } from "@/components/ui";
import { clientFields, type ClientErrors, type ClientField, type ClientRecord, type ClientType } from "./model";

export function ClientForm({ client }: { client?: ClientRecord }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<ClientType>(client?.type ?? "private_person");
  const [values, setValues] = useState<Record<ClientField, string>>(() => Object.fromEntries(Object.keys(clientFields).map(key => [key, client?.[key as ClientField] ?? ""])) as Record<ClientField, string>);
  const [errors, setErrors] = useState<ClientErrors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const inFlight = useRef(false);
  const cancelHref = client ? `/app/clients/${client.id}` : "/app/clients";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setErrors({}); setMessage(""); setConflict(false); setUnauthorized(false);
    let saved = false;
    try {
      const response = await fetch(client ? `/api/clients/${client.id}` : "/api/clients", {
        method: client ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, type, ...(client ? { version: client.version } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) {
        setErrors(result.fields ?? {}); setMessage(result.message ?? "Unable to save the client."); setConflict(response.status === 409);
        if (response.status === 401) { setMessage("Your session has ended. Sign in again, then reopen this form."); setUnauthorized(true); }
        requestAnimationFrame(() => (formRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus());
        return;
      }
      saved = true;
      router.push(`/app/clients/${result.client.id}?notice=${client ? "updated" : "created"}`);
      router.refresh();
    } catch { setMessage("Unable to connect. Your entries have been kept; please try again."); }
    finally { if (!saved) { inFlight.current = false; setBusy(false); } }
  }

  return <Card className="client-form-card">
    <form ref={formRef} onSubmit={submit} aria-busy={busy}>
      <p className="muted client-form-note">Name and client type are required. All contact, address and NUI fields are optional.</p>
      {message && <div role="alert" className="client-alert client-alert-error"><p>{message}</p>{errors.form && <p>{errors.form}</p>}{errors.version && <p>{errors.version}</p>}{conflict && <a className="text-link" href={client ? `/app/clients/${client.id}/edit` : "/app/clients"}>Reload latest client</a>}{unauthorized && <Link className="text-link" href={`/login?returnTo=${encodeURIComponent(client ? `/app/clients/${client.id}/edit` : "/app/clients/new")}`}>Sign in again</Link>}</div>}
      <fieldset disabled={busy} className="client-fieldset">
        <legend className="sr-only">Client information</legend>
        <div className="client-form-grid">
          <FormField label="Client type (required)" htmlFor="client-type"><select id="client-type" name="type" className="input" required value={type} onChange={event => setType(event.target.value as ClientType)} aria-invalid={Boolean(errors.type)} aria-describedby={errors.type ? "client-type-error" : undefined}><option value="private_person">Individual</option><option value="business">Business</option></select>{errors.type && <p id="client-type-error" className="client-field-error">{errors.type}</p>}</FormField>
          {Object.entries(clientFields).map(([key, field]) => {
            const name = key as ClientField;
            if (name === "nui" && type !== "business") return null;
            const error = errors[name];
            return <FormField key={name} label={name === "name" ? `${type === "business" ? "Business name" : "Full name"} (required)` : field.label} htmlFor={`client-${name}`}>
              <Input id={`client-${name}`} name={name} type={name === "email" ? "email" : name === "phone" ? "tel" : "text"} required={name === "name"} maxLength={field.max} value={values[name]} onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))} autoComplete={name === "email" ? "email" : name === "phone" ? "tel" : name === "addressLine1" ? "address-line1" : name === "addressLine2" ? "address-line2" : name === "city" ? "address-level2" : name === "postalCode" ? "postal-code" : name === "country" ? "country-name" : "off"} aria-invalid={Boolean(error)} aria-describedby={error ? `client-${name}-error` : name === "nui" ? "client-nui-hint" : undefined} />
              {name === "nui" && <p id="client-nui-hint" className="muted client-field-hint">Add an identifier if available. No country-specific format is required.</p>}
              {error && <p id={`client-${name}-error`} className="client-field-error">{error}</p>}
            </FormField>;
          })}
        </div>
        <div className="client-actions"><Button type="submit">{busy ? "Saving…" : client ? "Save changes" : "Create client"}</Button>{!busy && <Link href={cancelHref} className="text-link">Cancel</Link>}</div>
      </fieldset>
      <p className="sr-only" role="status" aria-live="polite">{busy ? "Saving client. Please wait." : ""}</p>
    </form>
  </Card>;
}
