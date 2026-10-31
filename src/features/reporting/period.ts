import {kosovoDate} from '@/lib/presentation';
import type {ReportFilter} from './validation';

/** Labels describe the applied transaction-date filter, never the download date. */
export function reportPeriod(filter:Pick<ReportFilter,'from'|'to'>){
 const {from,to}=filter;
 let month='';
 if(/^\d{4}-\d{2}-01$/.test(from)&&from.slice(0,7)===to.slice(0,7)){
  const date=new Date(`${from}T12:00:00Z`),last=new Date(date);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
  if(last.toISOString().slice(0,10)===to){const label=new Intl.DateTimeFormat('sq',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);month=label.charAt(0).toLocaleUpperCase('sq')+label.slice(1);}
 }
 const range=from&&to?`${kosovoDate(from)} — ${kosovoDate(to)}`:from?`Nga ${kosovoDate(from)} e tutje`:to?`Deri më ${kosovoDate(to)}`:'Të gjitha datat, pa kufizim periudhe';
 return {month,range,title:month?`Raporti për ${month}`:from||to?'Raporti për periudhën e zgjedhur':'Raporti për të gjithë periudhën',file:`raporti-${from||'fillimi'}-deri-${to||'pa-kufi'}`};
}
