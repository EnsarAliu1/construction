"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {WorkspaceIcon as Icon} from '@/components/layout/workspace-icon';

export type SearchChoice={id:string;label:string;version:number;isActive?:boolean};
type Props<T extends SearchChoice>={id:string;label:string;value:T|null;onChange:(value:T|null)=>void;endpoint:string;initialOptions?:T[];icon?:string;placeholder?:string;required?:boolean;disabled?:boolean;error?:string;emptyLabel?:string};
/** Searching is read-only. Only an explicit click or Enter changes the identity/version. */
export function SearchSelect<T extends SearchChoice>({id,label,value,onChange,endpoint,initialOptions,icon='search',placeholder='Kërkoni sipas emrit…',required=false,disabled=false,error,emptyLabel='Asnjë përzgjedhje'}:Props<T>){
 const uid=useId(),listId=`${uid}-results`,statusId=`${uid}-status`,input=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[rows,setRows]=useState<T[]>([]),[busy,setBusy]=useState(false),[failure,setFailure]=useState(''),[active,setActive]=useState(-1),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!open||disabled)return;
  const controller=new AbortController(),timer=setTimeout(async()=>{
   setBusy(true);setFailure('');
   try{const response=await fetch(endpoint+encodeURIComponent(query.trim()),{cache:'no-store',signal:controller.signal}),body=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error('search');setRows(body.rows.map((row:T&{name?:string})=>({...row,label:row.label??row.name??''})));setActive(-1);}
   catch{if(!controller.signal.aborted){setRows([]);setFailure('Kërkimi nuk u përfundua. Përzgjedhja juaj është ruajtur.');}}
   finally{if(!controller.signal.aborted)setBusy(false);}
  },query.trim()?250:0);
  return()=>{clearTimeout(timer);controller.abort();};
 },[open,query,endpoint,disabled,retry]);
 useEffect(()=>{if(open&&active>=0)document.getElementById(`${listId}-${active}`)?.scrollIntoView({block:'nearest'});},[open,active,listId]);
 function show(){if(disabled)return;setQuery('');setRows(initialOptions??[]);setActive(-1);setFailure('');setBusy(true);setOpen(true);}
 function choose(row:T){onChange(row);setOpen(false);setQuery('');setActive(-1);}
 return <div className="form-field search-select" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setOpen(false);setActive(-1);}}}>
  <label htmlFor={id}>{label}{required&&<span className="field-required" aria-hidden="true"> *</span>}</label>
  <div className={`search-select-control${open?' is-open':''}${error?' is-invalid':''}`}>
   <Icon name={icon}/><input ref={element=>{input.current=element;element?.setCustomValidity(required&&!value?'Zgjidhni një rezultat nga lista.':'');}} id={id} type="text" role="combobox" autoComplete="off" spellCheck={false} maxLength={100} placeholder={value?'Kërkoni një përzgjedhje tjetër…':placeholder} value={open?query:value?.label??''} disabled={disabled} required={required&&!value} aria-required={required} aria-invalid={Boolean(error)} aria-expanded={open} aria-autocomplete="list" aria-controls={open?listId:undefined} aria-activedescendant={open&&active>=0&&rows[active]?`${listId}-${active}`:undefined} aria-describedby={`${statusId}${error?` ${uid}-error`:''}`} onFocus={show} onChange={event=>{setQuery(event.target.value);setRows([]);setFailure('');setActive(-1);setBusy(true);setOpen(true);}} onKeyDown={event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open){show();return;}setActive(current=>event.key==='ArrowDown'?Math.min(rows.length-1,current+1):Math.max(0,current-1));}
    else if(event.key==='Enter'&&open){event.preventDefault();if(active>=0&&rows[active])choose(rows[active]);}
    else if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);setActive(-1);}
    else if(event.key==='Tab'){setOpen(false);setActive(-1);}
   }} onClick={()=>{if(!open)show();}}/>
   {value?<button type="button" className="search-select-clear" disabled={disabled} onClick={()=>{onChange(null);show();input.current?.focus();}} aria-label={`Pastroni përzgjedhjen: ${label}`}><Icon name="close"/></button>:<button type="button" className="search-select-clear" disabled={disabled} tabIndex={-1} onMouseDown={event=>event.preventDefault()} onClick={()=>{if(open)setOpen(false);else{show();input.current?.focus();}}} aria-label={`Hapni përzgjedhjet: ${label}`}><Icon name="chevron"/></button>}
  </div>
  <span className="search-selection-note" id={statusId}>{value?<><Icon name="check"/><span>{open?`Përzgjedhur: ${value.label}`:'Mund ta ndryshoni duke kërkuar përsëri'}{value.isActive===false?' · Joaktiv, lidhje historike':''}</span></>:emptyLabel}</span>
  {open&&<div className="search-select-popup">
   <div className="search-select-popup-heading"><span>{rows.length===20?'20 rezultate · saktësoni kërkimin':query?'Rezultatet e kërkimit':'Përzgjedhjet e disponueshme'}</span>{busy&&<span className="workspace-spinner" aria-hidden="true"/>}</div>
   <ul id={listId} role="listbox" aria-label={`${label} rezultatet e kërkimit`}>
    {rows.map((row,index)=><li id={`${listId}-${index}`} role="option" aria-selected={value?.id===row.id} key={row.id} className={active===index?'is-highlighted':''} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(row)}><span className="search-choice-icon"><Icon name={icon}/></span><span><strong>{row.label}</strong><small>{row.isActive===false?'Joaktiv · ':''}ID {row.id.slice(0,8)}</small></span>{value?.id===row.id&&<Icon name="check"/>}</li>)}
   </ul>
   {failure?<div className="search-select-empty"><Icon name="info"/><p role="alert">{failure}</p><button type="button" className="text-link" onClick={()=>setRetry(current=>current+1)}>Provoni përsëri</button></div>:!rows.length&&<div className="search-select-empty"><Icon name="search"/><p>{busy?'Duke kërkuar…':'Nuk u gjet asnjë rezultat.'}</p>{!busy&&<small>Provoni një emër tjetër ose një kërkim më të shkurtër.</small>}</div>}
   <p className="search-select-keyboard" aria-hidden="true"><span>↑ ↓ lëvizni · Enter përzgjidhni</span><span>Esc mbyllni</span></p>
  </div>}
  <span className="sr-only" role="status">{open?(busy?'Duke kërkuar…':failure?'':`${rows.length} rezultate. Përdorni shigjetat dhe Enter për të përzgjedhur.`):''}</span>
  {error&&<p className="client-field-error" id={`${uid}-error`}>{error}</p>}
 </div>;
}
