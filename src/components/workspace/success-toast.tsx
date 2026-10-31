'use client';
import {useEffect,useState} from 'react';
export function notifySuccess(message:string){window.dispatchEvent(new CustomEvent('fitimi:saved',{detail:message}));}
export function SuccessToast(){
 const [message,setMessage]=useState('');
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const expireWhenVisible=()=>{timer=document.querySelector('.app-form-modal[open]')?setTimeout(expireWhenVisible,150):setTimeout(()=>setMessage(''),6000);};const show=(event:Event)=>{setMessage((event as CustomEvent<string>).detail);clearTimeout(timer);expireWhenVisible();};window.addEventListener('fitimi:saved',show);return()=>{window.removeEventListener('fitimi:saved',show);clearTimeout(timer);};},[]);
 return <div className="save-toast-region" role="status" aria-live="polite" aria-atomic="true">{message&&<div className="save-toast"><span aria-hidden="true">✓</span><div><strong>Veprimi u përfundua</strong><p>{message}</p></div><button type="button" onClick={()=>setMessage('')} aria-label="Mbyllni njoftimin">×</button></div>}</div>;
}
