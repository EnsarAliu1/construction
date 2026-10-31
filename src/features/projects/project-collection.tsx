"use client";
import {kosovoDate} from "@/lib/presentation";
import {DataTable} from '@/components/workspace/data-table';
import Link from 'next/link';
import {useState} from 'react';
import {WorkspaceIcon as Icon} from '@/components/layout/workspace-icon';
import {displayEuro} from '@/features/dashboard/overview';
import {valueLabel} from '@/i18n/format';
import type {listProjects} from './service';
export function ProjectCollection({rows}:{rows:Awaited<ReturnType<typeof listProjects>>['rows']}){
 const [view,setView]=useState<'grid'|'list'>('grid');
 return <section className="site-collection"><div className="site-view-controls" aria-label="Pamja e punishteve"><button type="button" aria-pressed={view==='grid'} aria-label="Pamja me karta" onClick={()=>setView('grid')}><Icon name="app"/></button><button type="button" aria-pressed={view==='list'} aria-label="Pamja me listë" onClick={()=>setView('list')}><Icon name="list"/></button></div>{view==='grid'?<div className="site-card-grid">{rows.map(row=><Link href={`/app/projects/${row.id}`} className="site-card" key={row.id}><div className="site-card-cover"><div><span className="site-reference">ID · {row.id.slice(0,8)}</span><span className={`app-status ${row.status}`}>{valueLabel(row.status)}</span></div><p><Icon name="pin"/>{row.location||'Lokacioni nuk është dhënë'}</p></div><div className="site-card-body"><h2>{row.name}</h2><p>{row.clientName}</p><div className="site-card-contract"><span>Kontrata</span><strong>{row.totalValue===null?'Pa kontratë':displayEuro(row.totalValue)}</strong><Icon name="external"/></div><div className="site-card-dates"><Icon name="calendar"/>{row.startDate?kosovoDate(row.startDate):'Pa datë fillimi'} — {row.endDate?kosovoDate(row.endDate):'Pa datë përfundimi'}</div></div></Link>)}</div>:<div className="card table-card"><div className="table-scroll" role="region" tabIndex={0} aria-label="Lista e punishteve"><DataTable className="projects-table"><thead><tr><th>Punishtja / Klienti</th><th>Gjendja</th><th>Lokacioni</th><th>Kontrata</th><th>Veprimi</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><Link className="client-name-link" href={`/app/projects/${row.id}`}>{row.name}</Link><span className="muted">{row.clientName}</span></td><td><span className={`app-status ${row.status}`}>{valueLabel(row.status)}</span></td><td>{row.location??'Nuk është dhënë'}</td><td>{row.totalValue===null?'Pa kontratë':displayEuro(row.totalValue)}</td><td><Link className="text-link" href={`/app/projects/${row.id}`}>Shikoni →</Link></td></tr>)}</tbody></DataTable></div></div>}</section>;
}
