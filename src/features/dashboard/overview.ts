import type {Snapshot,DataRow} from '@/features/reporting/snapshot';
import {financeReports} from '@/features/reporting/finance';
import {reportFilter} from '@/features/reporting/validation';

export const BUSINESS_TIME_ZONE='Europe/Tirane';
const calendarFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:BUSINESS_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
const monthFormatter=new Intl.DateTimeFormat('sq-AL',{timeZone:BUSINESS_TIME_ZONE,month:'long',year:'numeric'});
const dateFormatter=new Intl.DateTimeFormat('sq-AL',{timeZone:BUSINESS_TIME_ZONE,weekday:'long',day:'numeric',month:'long',year:'numeric'});
const hourFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:BUSINESS_TIME_ZONE,hour:'2-digit',hourCycle:'h23'});
/** Calendar boundaries, independent of the server's OS timezone and rolling day counts. */
export function calendarMonth(now:Date){
 const parts=calendarFormatter.formatToParts(now);
 const part=(name:string)=>parts.find(p=>p.type===name)!.value;
 const year=part('year'),month=part('month'),last=new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate();
 return {from:`${year}-${month}-01`,to:`${year}-${month}-${last}`,today:`${year}-${month}-${part('day')}`,label:monthFormatter.format(now)};
}
export {displayEuro} from '@/lib/money-format';
export function dashboardOverview(snapshot:Snapshot,now=new Date()){
 const period=calendarMonth(now),[all,monthly]=financeReports(snapshot,[reportFilter(),reportFilter({from:period.from,to:period.to})]);
 const projectsById=new Map(snapshot.data.projects.map(p=>[p.id,p])),categoriesById=new Map(snapshot.data.expense_categories.map(c=>[c.id,c]));
 const recent=(rows:DataRow[])=>rows.filter(r=>String(r.transactionDate)>=period.from&&String(r.transactionDate)<=period.to).sort((a,b)=>String(b.transactionDate).localeCompare(String(a.transactionDate))||String(b.createdAt??'').localeCompare(String(a.createdAt??''))||String(b.id).localeCompare(String(a.id))).slice(0,5).map(r=>({id:String(r.id),amount:String(r.amount),date:String(r.transactionDate),description:String(r.description??''),projectName:String(projectsById.get(r.projectId)?.name??'Për kompaninë'),categoryName:String(categoriesById.get(r.categoryId)?.name??''),method:r.method==='bank'?'Bankë':'Para në dorë',cancelled:r.status==='cancelled',corrected:Number(r.version)>1}));
 const currentProjects=all.projects.filter(p=>p.deletedAt===null),projectIds=new Set(currentProjects.map(p=>p.id));
 return {period,monthly,all,activeContracts:snapshot.data.contracts.filter(c=>c.status==='active'&&projectIds.has(String(c.projectId))).length,
  counts:{projects:currentProjects.length,active:all.activeProjects,completed:all.statusCounts.find(s=>s.status==='completed')?.count??0,clients:snapshot.data.clients.filter(c=>c.deletedAt===null).length},
  recentPayments:recent(snapshot.data.payments),recentExpenses:recent(snapshot.data.expenses),
  activeSites:currentProjects.filter(p=>p.status==='active').sort((a,b)=>a.name.localeCompare(b.name,'sq')).slice(0,6),
  dateLabel:dateFormatter.format(now),
  greeting:Number(hourFormatter.format(now))<12?'Mirëmëngjes':'Mirëdita'};
}
export type DashboardOverview=ReturnType<typeof dashboardOverview>;
