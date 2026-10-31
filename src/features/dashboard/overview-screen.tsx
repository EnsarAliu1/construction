import {kosovoDate} from "@/lib/presentation";
import Link from 'next/link';
import {Card} from '@/components/ui';
import {WorkspaceIcon as Icon} from '@/components/layout/workspace-icon';
import {currentUser} from '@/server/auth/web';
import {materialize} from '@/features/reporting/snapshot';
import {reportingPage} from '@/features/reporting/web';
import {dashboardOverview,displayEuro,type DashboardOverview} from './overview';
import {PrivateTotals} from './private-totals';
import '@/styles/dashboard.css';

function Metric({label,value,note,icon,kind='',href}:{label:string;value:string;note:string;icon:string;kind?:string;href?:string}){
 const content=<><div className="dashboard-metric-top"><h2>{label}</h2><span className="dashboard-metric-icon"><Icon name={icon}/></span></div><p className="dashboard-metric-value">{displayEuro(value)}</p><div className="dashboard-metric-footer"><p className="dashboard-metric-note">{note}</p>{href&&<span className="metric-footer-mark" aria-hidden="true"><Icon name="external"/></span>}</div></>;
 return href?<Link className={`dashboard-metric ${kind}`} href={href}>{content}</Link>:<div className={`dashboard-metric ${kind}`}>{content}</div>;
}
function Recent({title,rows,expense=false}:{title:string;rows:DashboardOverview['recentPayments'];expense?:boolean}){
 const route=expense?'expenses':'payments';return <section className="dashboard-panel"><div className="dashboard-panel-heading"><h2>{title}</h2><Link href={`/app/${route}`}>Të gjitha <span aria-hidden="true">↗</span></Link></div>{rows.length?<ul className="dashboard-transactions">{rows.map(row=><li key={row.id}><span className={`dashboard-transaction-icon ${expense?'expense':'income'}`}><Icon name={expense?'expenses':'payments'}/></span><div className="dashboard-transaction-copy"><Link href={`/app/${route}/${row.id}`}>{expense?row.description:row.projectName}</Link><span>{kosovoDate(row.date)} · {expense?row.categoryName:row.method}</span></div><div className={`dashboard-transaction-value ${!expense&&!row.cancelled?'positive':''}`}><span className={row.cancelled?'is-cancelled':''}>{row.cancelled?'':expense?'−':'+'}{displayEuro(row.amount)}</span>{row.cancelled?<small className="dashboard-status cancelled">Anuluar</small>:row.corrected?<small className="dashboard-status corrected">Korrigjuar</small>:null}</div></li>)}</ul>:<div className="dashboard-panel-empty"><Icon name={expense?'expenses':'payments'}/><p>{expense?'Ende nuk ka shpenzime këtë muaj.':'Ende nuk ka pagesa këtë muaj.'}</p><Link href={`/app/${route}/new`}>{expense?'Regjistroni shpenzim':'Regjistroni pagesë'} <span aria-hidden="true">→</span></Link></div>}</section>;
}
export async function OverviewScreen(){
 const result=await reportingPage('/app',async(c,token)=>dashboardOverview(await materialize(c,token))),user=await currentUser();
 if(!result.data)return <Card><h1>Paneli kryesor</h1><p role="alert">{result.error}</p><Link className="text-link" href="/app">Provoni përsëri</Link></Card>;
 const d=result.data,month=d.period.label.charAt(0).toLocaleUpperCase('sq')+d.period.label.slice(1),firstName=user?.displayName.trim().split(/\s+/)[0]??'';
 return <div className="dashboard-overview">
  <div className="dashboard-welcome"><div className="dashboard-welcome-copy"><span className="dashboard-hero-label"><Icon name="app"/>Qendra e administrimit</span><p className="dashboard-overline">{d.dateLabel}</p><h1>{d.greeting}{firstName?', '+firstName:''}.</h1><p>Ja si qëndrojnë punishtet dhe financat e kompanisë sot.</p></div><div className="dashboard-quick-actions"><Link href="/app/expenses/new" className="dashboard-action secondary"><Icon name="expenses"/>Shpenzim</Link><Link href="/app/payments/new" className="dashboard-action primary"><Icon name="plus"/>Pagesë e re</Link></div></div>
  <div className="dashboard-period"><span><Icon name="calendar"/>Pasqyra mujore</span><strong>{month}</strong><span>{d.period.from.split('-').reverse().join('.')} — {d.period.to.split('-').reverse().join('.')}</span></div>
  <div className="dashboard-primary-metrics">
   <Metric label="Vlera e kontratave aktive" value={d.all.totals.contractValue} note={`${d.activeContracts} kontrata aktive · gjithsej`} icon="contract" kind="contract" href="/app/projects?status=active"/>
   <Metric label="Pagesat e pranuara" value={d.monthly.totals.income} note={`Muaji: ${month}`} icon="payments" kind="income" href={`/app/payments?from=${d.period.from}&to=${d.period.to}&status=received`}/>
   <Metric label="Shpenzimet e regjistruara" value={d.monthly.totals.expenses} note={`Muaji: ${month}`} icon="expenses" href={`/app/expenses?from=${d.period.from}&to=${d.period.to}&status=recorded`}/>
   <Metric label="Diferenca operative" value={d.monthly.totals.difference} note="Pagesa minus shpenzime · këtë muaj" icon="balance" kind="difference" href={`/app/reports?from=${d.period.from}&to=${d.period.to}`}/>
   <Metric label="Vlera e mbetur e kontratave" value={d.all.totals.outstanding} note="Shuma e papaguar · gjithsej" icon="hourglass" href="/app/projects?status=active"/>
  </div><p className="dashboard-financial-note"><Icon name="info"/>Diferenca operative është hyrje minus dalje, jo fitim kontabël i certifikuar. Anulimet nuk përfshihen në totalet aktive.</p>
  <div className="dashboard-counts">{([['Punishte gjithsej',d.counts.projects,'briefcase','/app/projects'],['Aktive',d.counts.active,'projects','/app/projects?status=active'],['Përfunduar',d.counts.completed,'check','/app/projects?status=completed'],['Klientë',d.counts.clients,'clients','/app/clients']] as const).map(([label,value,icon,href])=><Link className="dashboard-count" key={label} href={href}><span><Icon name={icon}/></span><div><strong>{value}</strong><p>{label}</p></div><Icon name="external"/></Link>)}</div>
  <div className="dashboard-recent"><Recent title="Pagesat e fundit" rows={d.recentPayments}/><Recent title="Shpenzimet e fundit" rows={d.recentExpenses} expense/></div>
  <section className="dashboard-panel dashboard-sites"><div className="dashboard-panel-heading"><div><h2>Pasqyra e punishtave aktive</h2><p>Gjendja financiare e secilës punishte, që nga fillimi.</p></div><Link href="/app/projects?status=active">Të gjitha <span aria-hidden="true">↗</span></Link></div>{d.activeSites.length?<div className="dashboard-site-grid">{d.activeSites.map(site=><Link href={`/app/projects/${site.id}`} className="dashboard-site" key={site.id}><div className="dashboard-site-top"><span><Icon name="projects"/>Punishte aktive</span><Icon name="external"/></div><h3>{site.name}</h3><dl><div><dt>Kontrata</dt><dd>{displayEuro(site.contractValue)}</dd></div><div><dt>Paguar</dt><dd className="positive">{displayEuro(site.income)}</dd></div><div><dt>Mbetur për t’u paguar</dt><dd>{displayEuro(site.outstanding)}</dd></div><div><dt>Shpenzime</dt><dd>{displayEuro(site.expenses)}</dd></div></dl></Link>)}</div>:<div className="dashboard-panel-empty"><Icon name="projects"/><p>Ende nuk ka punishte aktive.</p><Link href="/app/projects/new">Krijoni një punishte →</Link></div>}</section>
  <PrivateTotals><div className="dashboard-alltime-metrics"><Metric label="Pagesat e pranuara · gjithsej" value={d.all.totals.income} note="Që nga fillimi" icon="payments" kind="income"/><Metric label="Shpenzimet · gjithsej" value={d.all.totals.expenses} note="Që nga fillimi" icon="expenses"/><Metric label="Fitimi operativ · gjithsej" value={d.all.totals.difference} note="Pagesa minus shpenzime; jo fitim kontabël" icon="balance" kind="difference"/></div></PrivateTotals>
 </div>;
}
