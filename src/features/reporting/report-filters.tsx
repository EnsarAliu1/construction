'use client';
import Link from 'next/link';
import {useState} from 'react';
import type {ReportFilter} from './validation';
import {kosovoDate} from '@/lib/presentation';
export function ReportFilters({filter,categories}:{filter:ReportFilter;categories:{id:string;name:string}[]}){
 const [from,setFrom]=useState(filter.from),[to,setTo]=useState(filter.to);
 const [mode,setMode]=useState<'dates'|'month'>('dates');
 const [month,setMonth]=useState(filter.from.slice(0,7));
 function selectMonth(value:string){setMonth(value);if(!/^\d{4}-\d{2}$/.test(value))return;const [year,m]=value.split('-').map(Number);setFrom(value+'-01');setTo(value+'-'+new Date(Date.UTC(year,m,0)).getUTCDate());}
 return <form action="/app/reports" method="get" className="report-filter-form">
  <div className="report-period-tabs"><button type="button" aria-pressed={mode==='dates'} onClick={()=>setMode('dates')}>Periudhë e caktuar</button><button type="button" aria-pressed={mode==='month'} onClick={()=>setMode('month')}>Raport mujor</button></div>
  <div className="client-form-grid">{mode==='month'?<><div className="form-field"><label htmlFor="report-month">Zgjidhni muajin dhe vitin</label><input className="input" id="report-month" type="month" required min="1000-01" max="9999-12" value={month} onChange={e=>selectMonth(e.target.value)}/></div><p className="report-period-summary">{from&&to?`${kosovoDate(from)} — ${kosovoDate(to)}`:'Zgjidhni muajin e raportit.'}</p><input type="hidden" name="from" value={from}/><input type="hidden" name="to" value={to}/></>:<><div className="form-field"><label htmlFor="report-from">Nga data</label><input className="input" id="report-from" name="from" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="form-field"><label htmlFor="report-to">Deri më</label><input className="input" id="report-to" name="to" type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></div></>}
  <div className="form-field"><label htmlFor="report-category">Kategoria e shpenzimit</label><select className="input" id="report-category" name="categoryId" defaultValue={filter.categoryId}><option value="">Të gjitha kategoritë</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
  <div className="form-field"><label htmlFor="report-method">Mënyra e pagesave hyrëse</label><select className="input" id="report-method" name="method" defaultValue={filter.method}><option value="all">Të gjitha</option><option value="cash">Para në dorë</option><option value="bank">Transfer bankar</option></select></div></div>
  <div className="client-actions"><button className="button" type="submit">Gjeneroni raportin</button><Link className="text-link" href="/app/reports">Pastroni filtrat</Link></div><p className="muted">PDF dhe Excel përdorin periudhën dhe filtrat e raportit të shfaqur. Për shpenzimet e karburantit, zgjidhni kategorinë përkatëse dhe gjeneroni raportin. Kategoria nuk kufizon pagesat hyrëse.</p>
 </form>;
}
