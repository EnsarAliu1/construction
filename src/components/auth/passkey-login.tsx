"use client";
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {markLoginWelcome} from './login-welcome';

export function PasskeyLogin({returnTo,label='Hyr shpejt'}:{returnTo:string;label?:string}){
 const router=useRouter(),flight=useRef(false),error=useRef<HTMLParagraphElement>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function signIn(){
  if(flight.current)return;flight.current=true;setBusy(true);setMessage('');
  try{
   if(!window.isSecureContext||!window.PublicKeyCredential)throw new Error('unsupported');
   const r=await fetch('/api/auth/passkeys',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action:'authentication-options'})}),options=await r.json();
   if(!r.ok||!options.ok){setMessage(options.message??'Hyrja me pajisje nuk është e disponueshme.');return;}
   const {startAuthentication}=await import('@simplewebauthn/browser');
   const response=await startAuthentication({optionsJSON:options.options});
   const verified=await fetch('/api/auth/passkeys',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action:'authenticate',response,returnTo})}),result=await verified.json();
   if(!verified.ok||!result.ok){setMessage(result.message??'Verifikimi i pajisjes dështoi.');return;}
   markLoginWelcome();router.replace(result.returnTo);router.refresh();
  }catch{setMessage('Hyrja nuk u përfundua. Provoni sërish ose përdorni emailin dhe fjalëkalimin. Nëse është hera e parë, regjistroni pajisjen pas hyrjes.');}
  finally{flight.current=false;setBusy(false);requestAnimationFrame(()=>error.current?.focus());}
 }
 return <div className="passkey-login-block"><button type="button" className="button passkey-login-button" disabled={busy} onClick={()=>void signIn()}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3H4v4m12-4h4v4M4 17v4h4m12-4v4h-4M9 10V8a3 3 0 0 1 6 0v2m-6 0h6v7H9z"/></svg><span>{busy?'Konfirmoni në pajisje…':label}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button><p className="passkey-login-hint">Me PIN ose biometri në pajisjen e regjistruar.</p>{message&&<p className="login-error" ref={error} tabIndex={-1} role="alert">{message}</p>}</div>;
}
