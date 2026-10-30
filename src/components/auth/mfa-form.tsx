"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button, FormField, Input } from '@/components/ui';
import {markLoginWelcome} from './login-welcome';
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
            setMessage("Verifikimi ka skaduar ose është i padisponueshëm. Nisni hyrjen përsëri.");
    } }).catch(() => { if (active)
        setMessage("Verifikimi nuk mund të ngarkohet. Nisni hyrjen përsëri."); }); return () => { active = false; }; }, [change]);
    async function send(action: string, fields: Record<string, unknown> = {}) {
        if (flight.current)
            return;
        flight.current = true;
        setBusy(true);
        setMessage('');
        try {
            const r = await fetch('/api/auth/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, returnTo, ...fields }), cache: 'no-store' }), value = await r.json();
            if (!r.ok || !value.ok) {
                setMessage(value.message ?? "Verifikimi dështoi.");
                return;
            }
            if (value.state === 'complete') {
                if(!change)markLoginWelcome();
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
            setMessage("Përgjigjja është e pasigurt. Rifreskoni faqen për të kontrolluar hapin aktual. Kodet e rikuperimit dhe çelësat e konfigurimit nuk mund të shfaqen përsëri.");
        }
        finally {
            flight.current = false;
            setBusy(false);
            requestAnimationFrame(() => error.current?.focus());
        }
    }
    function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget, fields = Object.fromEntries(new FormData(form)); void send(data?.state === 'enroll' ? 'enroll' : recovery ? 'recovery' : 'verify', { code: fields.code }); form.reset(); }
    async function cancel() { await fetch('/api/auth/logout', { method: 'POST' }).then(r => { if (!r.ok)
        throw new Error(); setData(null); router.replace('/administrata'); router.refresh(); }).catch(() => setMessage("Anulimi dështoi. Provoni përsëri.")); }
    return <div aria-busy={busy}>{message && <p ref={error} role="alert" tabIndex={-1} className="login-error">{message}</p>}
  {change && !started && <form onSubmit={e => { e.preventDefault(); const form = e.currentTarget, f = Object.fromEntries(new FormData(form)); void send(String(f.purpose), { password: f.password, code: f.code }); form.reset(); }}><fieldset disabled={busy}><legend>Verifikoni fjalëkalimin dhe kodin aktual të autentikimit</legend><FormField label="Fjalëkalimi aktual" htmlFor="stepup-password"><Input id="stepup-password" name="password" type="password" autoComplete="current-password" required maxLength={1024}/></FormField><FormField label="Kodi aktual i autentikimit" htmlFor="stepup-code"><Input id="stepup-code" name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required minLength={6} maxLength={6}/></FormField><FormField label="Veprimi i sigurisë" htmlFor="stepup-purpose"><select id="stepup-purpose" name="purpose" className="input"><option value="replace">Ndryshoni aplikacionin e autentikimit</option><option value="codes">Zëvendësoni kodet e rikuperimit</option></select></FormField><Button type="submit">Verifikoni ndryshimin e sigurisë</Button></fieldset></form>}
  {data?.state === 'enroll' && <><p>Konfiguroni aplikacionin e autentikimit. Çelësi shfaqet vetëm një herë për këtë përpjekje. Ruajeni privatisht.</p>{data.seed ? <div className="mfa-setup">{/* Generated entirely locally; no external QR request. */}
   <Image unoptimized src={data.qr ?? ''} width={240} height={240} alt="Kodi QR për konfigurimin e autentikimit"/>
   <p>Çelësi për konfigurim manual: <code className="mfa-secret" data-testid="mfa-manual-key">{data.seed}</code></p><details><summary>Detajet e konfigurimit të autentikimit</summary><code className="mfa-secret">{data.uri}</code></details></div> : data.setupShown ? <p role="status">Konfigurimi është shfaqur më parë. Nëse nuk e keni ruajtur çelësin, nisni hyrjen përsëri për konfigurim të ri.</p> : <Button type="button" disabled={busy} onClick={() => void send('start')}>Shfaqni konfigurimin e autentikimit</Button>}
   <form onSubmit={submit}><fieldset disabled={busy || !data.seed}><FormField label="Kodi i autentikimit" htmlFor="mfa-code"><Input id="mfa-code" name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required minLength={6} maxLength={6}/></FormField><Button type="submit">Verifikoni konfigurimin e autentikimit</Button></fieldset></form></>}
  {data?.state === 'verify' && <><p>{recovery ? "Pas verifikimit të fjalëkalimit, përdorni një kod rikuperimi të papërdorur. Çdo kod përdoret vetëm një herë." : "Shkruani kodin aktual gjashtëshifror nga aplikacioni i autentikimit."}</p><form onSubmit={submit}><fieldset disabled={busy}><FormField label={recovery ? "Kodi i rikuperimit" : "Kodi i autentikimit"} htmlFor="mfa-code"><Input id="mfa-code" name="code" type="text" inputMode={recovery ? 'text' : 'numeric'} autoComplete="one-time-code" required pattern={recovery ? undefined : '[0-9]{6}'} maxLength={recovery ? 100 : 6}/></FormField><Button type="submit">{recovery ? "Përdorni kodin e rikuperimit" : "Verifikoni dhe hyni"}</Button></fieldset></form><Button type="button" disabled={busy} onClick={() => { setRecovery(!recovery); setMessage(''); }}>{recovery ? "Përdorni kodin e autentikimit" : "Përdorni një kod rikuperimi"}</Button></>}
  {data?.state === 'ack' && <><p>Ruajini privatisht këto 16 kode rikuperimi njëpërdorimëshe. Ato shfaqen vetëm një herë dhe nuk mund të merren përsëri.</p>{data.codes ? <ul className="mfa-codes">{data.codes.map(code => <li key={code}><code data-testid="mfa-recovery-code">{code}</code></li>)}</ul> : <p role="status">Kodet janë shfaqur më parë për këtë përpjekje. Nëse nuk i keni ruajtur, anuloni dhe nisni regjistrimin e sigurt përsëri ose kontaktoni operatorin.</p>}<label className="client-checkbox"><input type="checkbox" checked={saved} disabled={busy} onChange={e => setSaved(e.target.checked)}/>I kam ruajtur kodet e rikuperimit në mënyrë të sigurt.</label><Button type="button" disabled={busy || !saved} onClick={() => void send('acknowledge', { confirmation: 'saved' })}>Përfundoni hyrjen e sigurt</Button></>}
  <p className="login-help">Keni humbur pajisjen dhe kodet e rikuperimit? Kontaktoni operatorin e autorizuar Adore për rikuperim me verifikim të pavarur të identitetit.</p><div className="client-actions"><Button type="button" disabled={busy} onClick={() => void cancel()}>Anuloni dhe dilni</Button><Link href="/administrata">Nisni hyrjen përsëri</Link></div><p role="status" className="sr-only">{busy ? "Duke verifikuar në mënyrë të sigurt. Ju lutemi, prisni." : ''}</p>
 </div>;
}
