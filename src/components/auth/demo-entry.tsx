'use client';
import {useEffect,useState} from 'react';

export function DemoEntry(){
 const [attempt,setAttempt]=useState(0),[failed,setFailed]=useState(false);
 useEffect(()=>{
  const controller=new AbortController(),deadline=Date.now()+120_000;
  let timer:ReturnType<typeof setTimeout>|undefined;
  async function check(){
   try{
    const response=await fetch('/api/demo/status',{cache:'no-store',signal:controller.signal}),data=await response.json();
    if(controller.signal.aborted)return;
    if(response.ok&&data.ready&&typeof data.url==='string'){
     const url=new URL(data.url,window.location.origin);
     if((url.protocol==='https:'||url.protocol==='http:')&&url.pathname==='/administrata'&&!url.username&&!url.password){window.location.assign(url.href);return;}
    }
   }catch{if(controller.signal.aborted)return;}
   if(Date.now()>=deadline){setFailed(true);return;}
   timer=setTimeout(()=>void check(),1500);
  }
  void check();
  return()=>{controller.abort();if(timer)clearTimeout(timer);};
 },[attempt]);
 return <div className="demo-login"><p className="login-description" role="status" aria-live="polite">{failed?'Demoja nuk mund të nisej për momentin. Provoni përsëri.':'Po përgatitim aplikacionin demo. Do të kaloni automatikisht sapo të jetë gati.'}</p>{failed&&<button type="button" className="login-submit" onClick={()=>{setFailed(false);setAttempt(value=>value+1);}}>Provo përsëri</button>}<p className="muted">Nisja e parë mund të zgjasë rreth një minutë.</p></div>;
}
