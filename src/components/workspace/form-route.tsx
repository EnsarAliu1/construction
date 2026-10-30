"use client";
import {createContext,useContext,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {WorkspaceIcon} from '@/components/layout/workspace-icon';

const Intercepted=createContext(false);
export function InterceptedForms({children}:{children:ReactNode}){return <Intercepted.Provider value>{children}</Intercepted.Provider>;}
export function FormRoute({children}:{children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),dirty=useRef(false),router=useRouter(),pathname=usePathname(),intercepted=useContext(Intercepted),heading=useId();
 const [confirm,setConfirm]=useState(false),[waiting,setWaiting]=useState(false);
 const section=pathname.split('/')[2],labels:Record<string,string>={projects:'Punishtet',clients:'Klientët',payments:'Pagesat',expenses:'Shpenzimet',categories:'Kategoritë',persons:'Personat & Furnitorët',vehicles:'Automjetet'};
 const backTo=pathname.replace(/\/(new|edit|contract)$/,'');
 function leave(){if(intercepted)router.back();else router.replace(backTo);}
 function close(){if(dialog.current?.querySelector('[aria-busy="true"]')){setWaiting(true);return;}if(dirty.current)setConfirm(true);else leave();}
 useEffect(()=>{const element=dialog.current;element?.showModal();document.documentElement.classList.add('has-form-modal');const beforeUnload=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);return()=>{element?.close();document.documentElement.classList.remove('has-form-modal');window.removeEventListener('beforeunload',beforeUnload);};},[]);
 useEffect(()=>{if(confirm)dialog.current?.querySelector<HTMLButtonElement>('.app-modal-confirm button')?.focus();},[confirm]);
 return <dialog ref={dialog} className="app-form-modal" aria-labelledby={heading} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}><div className="app-form-modal-content" onKeyDownCapture={event=>{if(event.key==='Enter'&&(event.target as HTMLElement).getAttribute('aria-activedescendant'))dirty.current=true;}} onInputCapture={event=>{if((event.target as HTMLElement).getAttribute('role')!=='combobox')dirty.current=true;setWaiting(false);}} onChangeCapture={event=>{if((event.target as HTMLElement).getAttribute('role')!=='combobox')dirty.current=true;setWaiting(false);}} onClickCapture={event=>{const target=event.target as HTMLElement,button=target.closest('button');if(target.closest('[role=option]')||(button?.closest('form')&&button.type==='button'))dirty.current=true;const link=target.closest('a');if(link&&/^(Anul|Kthehu)/i.test(link.textContent?.trim()??'')){event.preventDefault();close();}}}>
  <div className="app-modal-context"><span id={heading}>{labels[section]??'Formulari'} <span aria-hidden="true">/</span> {pathname.endsWith('/new')?'Regjistrim i ri':'Ndryshoni të dhënat'}</span><button className="workspace-icon-button" type="button" aria-label="Mbyllni formularin" onClick={close}><WorkspaceIcon name="close"/></button></div>
  {waiting&&<p role="status" className="client-alert">Prisni përfundimin e ruajtjes para se ta mbyllni formularin.</p>}
  {confirm&&<div role="alert" aria-labelledby={`${heading}-confirm`} className="app-modal-confirm"><h2 id={`${heading}-confirm`}>T’i lini ndryshimet e paruajtura?</h2><p>Të dhënat që keni plotësuar nuk janë ruajtur ende.</p><div className="client-actions"><button className="button client-secondary" type="button" onClick={()=>setConfirm(false)}>Vazhdoni plotësimin</button><button className="button" type="button" onClick={()=>{dirty.current=false;leave();}}>Po, mbylleni</button></div></div>}
  <div hidden={confirm}>{children}</div>
 </div></dialog>;
}
