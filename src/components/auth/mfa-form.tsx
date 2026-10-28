"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button, FormField, Input } from '@/components/ui';
type Data = {
    state: 'enroll' | 'verify' | 'ack' | 'complete';
    seed?: string;
    uri?: string;
    qr?: string;
    codes?: string[];
    setupShown?: boolean;
};
export function MfaForm({ returnTo, change = false }: {
    returnTo: string;
    change?: boolean;
}) {
    const router = useRouter(), [data, setData] = useState<Data | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [recovery, setRecovery] = useState(false), [saved, setSaved] = useState(false), [started, setStarted] = useState(!change);
    const flight = useRef(false), error = useRef<HTMLParagraphElement>(null);
    useEffect(() => { if (change)
        return; let active = true; void fetch('/api/auth/mfa', { cache: 'no-store' }).then(r => r.json()).then(value => { if (active) {
        if (value.ok)
            setData(value);
        else
            setMessage('Verification expired or unavailable. Restart sign-in.');
    } }).catch(() => { if (active)
        setMessage('Unable to load verification. Restart sign-in.'); }); return () => { active = false; }; }, [change]);
    async function send(action: string, fields: Record<string, unknown> = {}) {
        if (flight.current)
            return;
        flight.current = true;
        setBusy(true);
        setMessage('');
        try {
            const r = await fetch('/api/auth/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, returnTo, ...fields }), cache: 'no-store' }), value = await r.json();
            if (!r.ok || !value.ok) {
                setMessage(value.message ?? 'Verification failed.');
                return;
            }
            if (value.state === 'complete') {
                setData(null);
                setStarted(!change);
                router.replace(value.returnTo);
                router.refresh();
                return;
            }
            setStarted(true);
            setData(value);
            setSaved(false);
        }
        catch {
            setMessage('Response uncertain. Refresh to check the current step. Recovery codes and setup secrets cannot be displayed again.');
        }
        finally {
            flight.current = false;
            setBusy(false);
            requestAnimationFrame(() => error.current?.focus());
        }
    }
    function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget, fields = Object.fromEntries(new FormData(form)); void send(data?.state === 'enroll' ? 'enroll' : recovery ? 'recovery' : 'verify', { code: fields.code }); form.reset(); }
    async function cancel() { await fetch('/api/auth/logout', { method: 'POST' }).then(r => { if (!r.ok)
        throw new Error(); setData(null); router.replace('/login'); router.refresh(); }).catch(() => setMessage('Unable to cancel. Please retry.')); }
    return <div aria-busy={busy}>{message && <p ref={error} role="alert" tabIndex={-1} className="login-error">{message}</p>}
  {change && !started && <form onSubmit={e => { e.preventDefault(); const form = e.currentTarget, f = Object.fromEntries(new FormData(form)); void send(String(f.purpose), { password: f.password, code: f.code }); form.reset(); }}><fieldset disabled={busy}><legend>Verify your password and current authenticator</legend><FormField label="Current password" htmlFor="stepup-password"><Input id="stepup-password" name="password" type="password" autoComplete="current-password" required maxLength={1024}/></FormField><FormField label="Current authenticator code" htmlFor="stepup-code"><Input id="stepup-code" name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required minLength={6} maxLength={6}/></FormField><FormField label="Security action" htmlFor="stepup-purpose"><select id="stepup-purpose" name="purpose" className="input"><option value="replace">Replace authenticator</option><option value="codes">Replace recovery codes</option></select></FormField><Button type="submit">Verify security change</Button></fieldset></form>}
  {data?.state === 'enroll' && <><p>Set up an authenticator app. The setup key is displayed once for this attempt. Keep it private.</p>{data.seed ? <div className="mfa-setup">{/* Generated entirely locally; no external QR request. */}
   <Image unoptimized src={data.qr ?? ''} width={240} height={240} alt="Authenticator setup QR code"/>
   <p>Manual setup key: <code className="mfa-secret" data-testid="mfa-manual-key">{data.seed}</code></p><details><summary>Authenticator provisioning details</summary><code className="mfa-secret">{data.uri}</code></details></div> : data.setupShown ? <p role="status">Setup was already displayed. If you did not save the key, restart sign-in to generate a new setup.</p> : <Button type="button" disabled={busy} onClick={() => void send('start')}>Show authenticator setup</Button>}
   <form onSubmit={submit}><fieldset disabled={busy || !data.seed}><FormField label="Authenticator code" htmlFor="mfa-code"><Input id="mfa-code" name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required minLength={6} maxLength={6}/></FormField><Button type="submit">Verify authenticator setup</Button></fieldset></form></>}
  {data?.state === 'verify' && <><p>{recovery ? 'Use one unused recovery code after your password verification. Each code works once.' : 'Enter the current six-digit code from your authenticator app.'}</p><form onSubmit={submit}><fieldset disabled={busy}><FormField label={recovery ? 'Recovery code' : 'Authenticator code'} htmlFor="mfa-code"><Input id="mfa-code" name="code" type="text" inputMode={recovery ? 'text' : 'numeric'} autoComplete="one-time-code" required pattern={recovery ? undefined : '[0-9]{6}'} maxLength={recovery ? 100 : 6}/></FormField><Button type="submit">{recovery ? 'Use recovery code' : 'Verify and sign in'}</Button></fieldset></form><Button type="button" disabled={busy} onClick={() => { setRecovery(!recovery); setMessage(''); }}>{recovery ? 'Use authenticator instead' : 'Use a recovery code'}</Button></>}
  {data?.state === 'ack' && <><p>Save these 16 single-use recovery codes privately. They are displayed once. They cannot be retrieved later.</p>{data.codes ? <ul className="mfa-codes">{data.codes.map(code => <li key={code}><code data-testid="mfa-recovery-code">{code}</code></li>)}</ul> : <p role="status">Codes were already displayed for this attempt. If you did not save them, cancel and restart secure enrollment or contact your operator.</p>}<label className="client-checkbox"><input type="checkbox" checked={saved} disabled={busy} onChange={e => setSaved(e.target.checked)}/>I saved my recovery codes securely.</label><Button type="button" disabled={busy || !saved} onClick={() => void send('acknowledge', { confirmation: 'saved' })}>Finish secure sign-in</Button></>}
  <p className="login-help">Lost your device and recovery codes? Contact your authorized Adore operator for independently verified recovery.</p><div className="client-actions"><Button type="button" disabled={busy} onClick={() => void cancel()}>Cancel and sign out</Button><Link href="/login">Restart sign-in</Link></div><p role="status" className="sr-only">{busy ? 'Verifying securely. Please wait.' : ''}</p>
 </div>;
}
