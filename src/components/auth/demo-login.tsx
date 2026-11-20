'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';

export function DemoLogin({automatic=false}:{automatic?:boolean}){
 const [pending,setPending]=useState(false),[error,setError]=useState('');
 const started=useRef(false);
 const router=useRouter();
 const launch=useCallback(async()=>{
  if(started.current)return;started.current=true;setPending(true);setError('');
  try{const response=await fetch('/api/demo/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),data=await response.json();if(!response.ok||!data.ok)throw new Error(data.message||'Demoja nuk mund të hapej. Provoni përsëri.');router.push('/app');router.refresh();}
  catch(error){setError(error instanceof Error?error.message:'Demoja nuk mund të hapej.');started.current=false;setPending(false);}
 },[router]);
 useEffect(()=>{if(automatic&&!started.current)void launch();},[automatic,launch]);
 return <div className="demo-login"><button type="button" className="login-submit" disabled={pending} onClick={()=>void launch()}>{pending?'Duke përgatitur hapësirën tuaj…':'Provo Demo →'}</button><p className="muted">Pa regjistrim. Të dhëna fiktive. Hapësirë personale për 30 minuta.</p>{error&&<p role="alert" className="login-error">{error}</p>}<p role="status" aria-live="polite">{pending?'Po krijohen projektet dhe dokumentet shembull. Mund të zgjasë disa sekonda.':''}</p></div>;
}
