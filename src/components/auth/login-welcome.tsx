"use client";
import {useEffect,useState} from 'react';

// A display-only hint, never an authentication or authorization credential.
export const LOGIN_WELCOME_KEY='fitimi:login-welcome';
export function markLoginWelcome(){try{sessionStorage.setItem(LOGIN_WELCOME_KEY,'1');}catch{/* Login still works when browser storage is unavailable. */}}
export function LoginWelcome(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  let marked=false;try{marked=sessionStorage.getItem(LOGIN_WELCOME_KEY)==='1';}catch{return;}
  if(!marked)return;
  const show=window.setTimeout(()=>{try{sessionStorage.removeItem(LOGIN_WELCOME_KEY);}catch{/* Cosmetic only. */}setVisible(true);},0);
  const hide=window.setTimeout(()=>setVisible(false),7000);
  return()=>{clearTimeout(show);clearTimeout(hide);};
 },[]);
 return visible?<div className="login-welcome" role="status" aria-live="polite"><span className="login-welcome-check" aria-hidden="true">✓</span><div><strong>Mirë se erdhët në Construction.</strong><p>Hyrja u përfundua me sukses. Punë të mbarë!</p></div><button type="button" aria-label="Mbyll njoftimin e hyrjes" onClick={()=>setVisible(false)}>×</button><span className="login-welcome-progress" aria-hidden="true"/></div>:null;
}
