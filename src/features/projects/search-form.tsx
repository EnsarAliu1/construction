"use client";
import {useRef,useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {WorkspaceIcon as Icon} from '@/components/layout/workspace-icon';
import type {ClientChoice} from './service';
import {ClientPicker} from './client-picker';
export function ProjectSearchForm({query,choices,filteredClient}:{query:{q:string;status:string;clientId:string|null};choices:ClientChoice[];filteredClient:ClientChoice|null}){
 const [selected,setSelected]=useState(filteredClient),[pending,start]=useTransition(),router=useRouter(),form=useRef<HTMLFormElement>(null);
 function navigate(status:string){const q=String(new FormData(form.current!).get('q')??'').trim();start(()=>router.push('/app/projects?'+new URLSearchParams({q,status,...(selected?{clientId:selected.id}:{})})));}
 function search(event:FormEvent){event.preventDefault();navigate(query.status);}
 return <form ref={form} action="/app/projects" onSubmit={search} aria-busy={pending} className="management-project-filters"><div className="management-filter-toolbar"><div className="management-search"><Icon name="search"/><label htmlFor="projects-search" className="sr-only">Kërkoni punishten, lokacionin ose klientin</label><input className="input" id="projects-search" name="q" type="search" placeholder="Kërko emër, lokacion ose klient…" maxLength={100} defaultValue={query.q}/><button type="submit" aria-label="Kërkoni punishtet" disabled={pending}><Icon name="external"/></button></div><div className="management-tabs" aria-label="Gjendja e punishteve">{[['all','Të gjitha'],['active','Aktive'],['completed','Përfunduar'],['suspended','Pezulluar']].map(([value,label])=><button type="button" key={value} aria-pressed={query.status===value} disabled={pending} onClick={()=>navigate(value)}>{label}</button>)}</div><Link className="text-link" href="/app/projects">Pastro</Link></div><details className="management-client-filter"><summary>Filtroni sipas klientit{selected?' · '+selected.name:''}</summary><ClientPicker idPrefix="filter-project" choices={choices} selected={selected} onSelect={setSelected} optional/><button type="submit" className="button client-secondary" disabled={pending}>Zbatoni filtrin e klientit</button></details></form>;
}
